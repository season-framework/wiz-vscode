/**
 * Wiz VSCode Extension (Refactored)
 * 확장 프로그램 진입점
 */

const vscode = require('vscode');
const path = require('path');

const FileExplorerProvider = require('./explorer/fileExplorerProvider');
const AppEditorProvider = require('./editor/appEditorProvider');
const AppContextListener = require('./editor/appContextListener');
const WizFileSystemProvider = require('./editor/wizFileSystemProvider');
const NpmEditor = require('./editor/editors/npmEditor');
const PipEditor = require('./editor/editors/pipEditor');
const { WizPathUtils } = require('./core');
const { SourceManager, PackageManager, ProjectManager, FileManager, BuildManager, McpManager, NavigationManager } = require('./services');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // ==================== Core Providers ====================
    const appEditorProvider = new AppEditorProvider(context);
    const appContextListener = new AppContextListener(context);
    const fileExplorerProvider = new FileExplorerProvider(
        undefined,
        context.extensionPath,
        undefined,
        context.extension.packageJSON?.version || 'unknown'
    );

    // Register Wiz File System
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider('wiz', new WizFileSystemProvider(), { 
            isCaseSensitive: true 
        })
    );

    // Register Webview Serializer for Info Tab Split/Restore
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer('wizAppInfo', {
            async deserializeWebviewPanel(webviewPanel, state) {
                if (state && state.appPath) {
                    appEditorProvider.reviveInfoEditor(webviewPanel, state.appPath, appContextListener);
                }
            }
        })
    );

    // ==================== Workspace State ====================
    let workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let currentProject = 'main';

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            updateProjectRoot();
        })
    );

    // ==================== Service Managers ====================
    const buildManager = new BuildManager({
        getWizRoot: () => workspaceRoot,
        getCurrentProject: () => currentProject
    });

    const mcpManager = new McpManager({
        extensionPath: context.extensionPath,
        getWizRoot: () => workspaceRoot,
        getCurrentProject: () => currentProject,
        onStateChange: (state) => {
            fileExplorerProvider.mcpConfigExists = state.mcpConfigExists;
            fileExplorerProvider.mcpServerRunning = state.mcpServerRunning;
            fileExplorerProvider.refresh();
        }
    });

    const sourceManager = new SourceManager({
        workspaceRoot: fileExplorerProvider.workspaceRoot,
        onRefresh: () => fileExplorerProvider.refresh()
    });
    
    const packageManager = new PackageManager({
        workspaceRoot: fileExplorerProvider.workspaceRoot,
        wizRoot: fileExplorerProvider.wizRoot,
        currentProject: currentProject,
        onRefresh: () => fileExplorerProvider.refresh(),
        outputChannel: buildManager.getOutputChannel()
    });

    const projectManager = new ProjectManager({
        wizRoot: workspaceRoot,
        onRefresh: () => fileExplorerProvider.refresh(),
        outputChannel: buildManager.getOutputChannel()
    });

    const fileManager = new FileManager({
        onRefresh: () => fileExplorerProvider.refresh(),
        getWorkspaceRoot: () => fileExplorerProvider.workspaceRoot
    });

    const navigationManager = new NavigationManager({
        getWorkspaceRoot: () => fileExplorerProvider.workspaceRoot,
        openInfoEditor: (appPath) => appEditorProvider.openInfoEditor(appPath, appContextListener),
        getActiveEditor: () => appEditorProvider.activeEditor,
        closeWebview: () => appEditorProvider.closeWebview?.() || appEditorProvider.currentWebviewPanel?.dispose()
    });

    // Inject build trigger to AppEditorProvider
    appEditorProvider.onFileSaved = () => buildManager.triggerBuild(false);

    // 파일 저장 시 자동 빌드 이벤트 등록 (BuildManager에 위임)
    buildManager.registerSaveWatcher(context);

    function resolveProjectNameCase(wizRoot, projectName) {
        if (!wizRoot || !projectName) return projectName;
        try {
            const projectBase = path.join(wizRoot, 'project');
            if (!require('fs').existsSync(projectBase)) return projectName;
            const entries = require('fs').readdirSync(projectBase, { withFileTypes: true });
            const matched = entries.find(
                e => e.isDirectory() && e.name.toLowerCase() === projectName.toLowerCase()
            );
            return matched ? matched.name : projectName;
        } catch (e) {
            return projectName;
        }
    }

    // ==================== Workspace State Sync ====================
    function updateProjectRoot() {
        if (!workspaceRoot) {
            fileExplorerProvider.workspaceRoot = undefined;
            fileExplorerProvider.wizRoot = undefined;
            fileExplorerProvider.currentProjectName = currentProject;
            fileExplorerProvider.refresh();
            return;
        }

        const displayProjectName = resolveProjectNameCase(workspaceRoot, currentProject);
        const projectPath = path.join(workspaceRoot, 'project', displayProjectName);
        fileExplorerProvider.workspaceRoot = projectPath;
        fileExplorerProvider.wizRoot = workspaceRoot;
        fileExplorerProvider.currentProjectName = displayProjectName;
        fileExplorerProvider.refresh();
        
        if (treeView) {
            treeView.title = displayProjectName;
        }

        // Service managers 상태 동기화
        sourceManager.workspaceRoot = fileExplorerProvider.workspaceRoot;
        packageManager.workspaceRoot = fileExplorerProvider.workspaceRoot;
        packageManager.wizRoot = fileExplorerProvider.wizRoot;
        packageManager.currentProject = currentProject;
        projectManager.wizRoot = workspaceRoot;

        // 프로젝트 전환 시 편집 추적 초기화
        buildManager.clearEditedDocuments();

        // MCP 서버와 상태 동기화 (.vscode/.wiz-state.json)
        mcpManager.writeState();
    }

    // ==================== Tree View ====================
    const WizDragAndDropController = require('./explorer/wizDragAndDropController');
    const dragAndDropController = new WizDragAndDropController(fileExplorerProvider);
    
    const treeView = vscode.window.createTreeView('wizExplorer', {
        treeDataProvider: fileExplorerProvider,
        showCollapseAll: true,
        canSelectMany: true,
        dragAndDropController: dragAndDropController
    });
    context.subscriptions.push(treeView);
    updateProjectRoot();

    // 최신 버전 확인 (GitHub tags에서 조회)
    (async () => {
        try {
            const https = require('https');
            const data = await new Promise((resolve, reject) => {
                const req = https.get('https://api.github.com/repos/season-framework/wiz-vscode/tags?per_page=1', {
                    headers: { 'User-Agent': 'wiz-vscode-extension' }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => resolve(body));
                });
                req.on('error', reject);
                req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            const tags = JSON.parse(data);
            if (tags.length > 0) {
                const latest = tags[0].name.replace(/^v/, '');
                fileExplorerProvider.latestVersion = latest;
                fileExplorerProvider.refresh();
            }
        } catch (e) { /* 네트워크 오류 무시 */ }
    })();

    // Auto-reveal on file change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (editor && treeView.visible) {
                 // Skip auto-reveal during file save/build process to prevent loops
                 // or if the editor is not relevant
                 if (editor.document.isDirty) return;

                const uri = editor.document.uri;
                let filePath;

                if (uri.scheme === 'file') {
                    filePath = uri.fsPath;
                } else if (uri.scheme === 'wiz') {
                    filePath = WizPathUtils.getRealPathFromUri(uri);
                }

                if (filePath) {
                    try {
                        // Prevent infinite loop if update takes too long
                        const item = await Promise.race([
                            fileExplorerProvider.findItem(filePath),
                            new Promise(resolve => setTimeout(() => resolve(null), 500))
                        ]);
                        
                        if (item) {
                            // Check if item still exists before revealing
                            if (fs.existsSync(item.resourceUri.fsPath)) {
                                treeView.reveal(item, { select: true, focus: false, expand: true });
                            }
                        }
                    } catch (e) {
                        // Ignore reveal errors
                    }
                }
            }
        })
    );


    // ==================== Commands Registration ====================
    const commands = [
        // Core commands
        ['wizExplorer.refresh', () => fileExplorerProvider.refresh()],
        ['wizExplorer.openAppEditor', (appPath, groupType) => appEditorProvider.openEditor(appPath, groupType)],
        ['wizExplorer.openPortalInfo', (portalJsonPath) => appEditorProvider.openPortalInfoEditor(portalJsonPath)],
        ['wizExplorer.updateExtension', async () => {
            const latest = fileExplorerProvider.latestVersion;
            const current = context.extension.packageJSON?.version || '0.0.0';
            if (!latest) {
                vscode.window.showInformationMessage('버전 정보를 확인할 수 없습니다.');
                return;
            }
            const pa = latest.split('.').map(Number);
            const pb = current.split('.').map(Number);
            let hasUpdate = false;
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                if ((pa[i] || 0) > (pb[i] || 0)) { hasUpdate = true; break; }
                if ((pa[i] || 0) < (pb[i] || 0)) break;
            }
            if (!hasUpdate) {
                vscode.window.showInformationMessage(`현재 v${current}은 최신 버전입니다.`);
                return;
            }
            const pick = await vscode.window.showInformationMessage(
                `새 버전 v${latest}이 있습니다 (현재 v${current}). 업데이트하시겠습니까?`,
                '업데이트'
            );
            if (pick === '업데이트') {
                const vsixUrl = `https://github.com/season-framework/wiz-vscode/releases/download/v${latest}/wiz-vscode-${latest}.vsix`;
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: `Wiz v${latest} 다운로드 중...`, cancellable: false },
                    async (progress) => {
                        try {
                            const https = require('https');
                            const os = require('os');
                            const tmpPath = require('path').join(os.tmpdir(), `wiz-vscode-${latest}.vsix`);

                            // GitHub releases → 302 redirect 처리 포함 다운로드
                            await new Promise((resolve, reject) => {
                                const download = (url) => {
                                    https.get(url, { headers: { 'User-Agent': 'wiz-vscode-extension' } }, (res) => {
                                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                            download(res.headers.location);
                                            return;
                                        }
                                        if (res.statusCode !== 200) {
                                            reject(new Error(`HTTP ${res.statusCode}`));
                                            return;
                                        }
                                        const fileStream = require('fs').createWriteStream(tmpPath);
                                        res.pipe(fileStream);
                                        fileStream.on('finish', () => { fileStream.close(); resolve(); });
                                        fileStream.on('error', reject);
                                    }).on('error', reject);
                                };
                                download(vsixUrl);
                            });

                            progress.report({ message: '설치 중...' });
                            await vscode.commands.executeCommand(
                                'workbench.extensions.installExtension',
                                vscode.Uri.file(tmpPath)
                            );

                            // 임시 파일 정리
                            try { require('fs').unlinkSync(tmpPath); } catch (e) { /* skip */ }

                            const reload = await vscode.window.showInformationMessage(
                                '업데이트가 완료되었습니다. 다시 로드하시겠습니까?',
                                '다시 로드'
                            );
                            if (reload === '다시 로드') {
                                await vscode.commands.executeCommand('workbench.action.reloadWindow');
                            }
                        } catch (err) {
                            vscode.window.showErrorMessage(`업데이트 실패: ${err.message}`);
                        }
                    }
                );
            }
        }],

        // MCP Server commands
        ['wizExplorer.startMcpServer', () => mcpManager.start()],
        ['wizExplorer.stopMcpServer', () => mcpManager.stop()],
        ['wizExplorer.showMcpConfig', () => mcpManager.showConfig()],
        ['wizExplorer.createMcpConfig', () => mcpManager.createConfig()],
        ['wizExplorer.mcpConfigMenu', async () => {
            const mcpJsonPath = mcpManager._getMcpJsonPath();
            const exists = mcpJsonPath && require('fs').existsSync(mcpJsonPath);

            if (!exists) {
                await mcpManager.createConfig();
                return;
            }

            const pick = await vscode.window.showQuickPick(
                [
                    { label: '$(file-code) 설정 보기', description: '.vscode/mcp.json 열기', id: 'show' },
                    { label: '$(refresh) 초기화 하기', description: 'MCP 서버 중지 및 설정 재생성', id: 'reset' }
                ],
                { title: 'MCP Configuration', placeHolder: '원하는 작업을 선택하세요' }
            );
            if (!pick) return;

            if (pick.id === 'show') {
                await mcpManager.showConfig();
            } else if (pick.id === 'reset') {
                await mcpManager.resetConfig();
            }
        }],
        
        // Git에서 .github 불러오기
        ['wizExplorer.importGithubFromGit', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            const gitUrl = await vscode.window.showInputBox({
                title: 'Git에서 .github 불러오기',
                prompt: 'Git 레포지토리 주소를 입력하세요',
                placeHolder: 'https://github.com/user/repo.git',
                ignoreFocusOut: true
            });
            if (!gitUrl) return;

            const githubPath = require('path').join(workspaceRoot, '.github');
            const githubExists = require('fs').existsSync(githubPath);

            const confirm = await vscode.window.showWarningMessage(
                githubExists
                    ? `기존 .github 디렉토리가 삭제되고 "${gitUrl}" 레포로 교체됩니다. 계속하시겠습니까?`
                    : `"${gitUrl}" 레포를 .github 디렉토리로 클론합니다. 계속하시겠습니까?`,
                { modal: true },
                '확인'
            );
            if (confirm !== '확인') return;

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: '.github 불러오는 중...' },
                async () => {
                    const cp = require('child_process');
                    const util = require('util');
                    const exec = util.promisify(cp.exec);
                    try {
                        if (githubExists) {
                            await exec(`rm -rf "${githubPath}"`);
                        }
                        await exec(`git clone "${gitUrl}" "${githubPath}"`);
                        // .git 디렉토리 제거 (독립 레포 히스토리 불필요)
                        const dotGitPath = require('path').join(githubPath, '.git');
                        if (require('fs').existsSync(dotGitPath)) {
                            await exec(`rm -rf "${dotGitPath}"`);
                        }
                        vscode.window.showInformationMessage('.github 디렉토리를 성공적으로 불러왔습니다.');
                        fileExplorerProvider.refresh();
                    } catch (err) {
                        vscode.window.showErrorMessage(`Git 클론 실패: ${err.message}`);
                    }
                }
            );
        }],

        // Build command
        ['wizExplorer.build', () => buildManager.normalBuild()],
        ['wizExplorer.selectBuildPythonInterpreter', () => buildManager.selectBuildPythonInterpreter()],

        // npm 패키지 관리
        ['wizExplorer.openNpmManager', () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }
            const npmEditor = new NpmEditor(context, {
                wizRoot: workspaceRoot,
                currentProject: currentProject,
                outputChannel: buildManager.getOutputChannel()
            });
            npmEditor.create();
        }],

        // pip 패키지 관리
        ['wizExplorer.openPipManager', async () => {
            let pythonPath = buildManager.getResolvedPythonPath();
            if (!pythonPath || !require('fs').existsSync(pythonPath)) {
                const selected = await buildManager.selectBuildPythonInterpreter();
                if (!selected) return;
                pythonPath = buildManager.getResolvedPythonPath();
            }
            if (!pythonPath) {
                vscode.window.showErrorMessage('Python 환경이 선택되지 않았습니다.');
                return;
            }
            const pipEditor = new PipEditor(context, {
                pythonPath: pythonPath,
                outputChannel: buildManager.getOutputChannel()
            });
            pipEditor.create();
        }],
        
        // File switch commands
        ['wizExplorer.switch.info', () => navigationManager.switchFile('info')],
        ['wizExplorer.switch.controller', () => navigationManager.switchFile('controller')],
        ['wizExplorer.switch.ui', () => navigationManager.switchFile('ui')],
        ['wizExplorer.switch.component', () => navigationManager.switchFile('component')],
        ['wizExplorer.switch.scss', () => navigationManager.switchFile('scss')],
        ['wizExplorer.switch.api', () => navigationManager.switchFile('api')],
        ['wizExplorer.switch.socket', () => navigationManager.switchFile('socket')],
        
        // Active state commands (same behavior)
        ['wizExplorer.switch.info.active', () => navigationManager.switchFile('info')],
        ['wizExplorer.switch.controller.active', () => navigationManager.switchFile('controller')],
        ['wizExplorer.switch.ui.active', () => navigationManager.switchFile('ui')],
        ['wizExplorer.switch.component.active', () => navigationManager.switchFile('component')],
        ['wizExplorer.switch.scss.active', () => navigationManager.switchFile('scss')],
        ['wizExplorer.switch.api.active', () => navigationManager.switchFile('api')],
        ['wizExplorer.switch.socket.active', () => navigationManager.switchFile('socket')],

        // Keyboard navigation commands
        ['wizExplorer.navigatePrevious', () => navigationManager.navigateFile('previous')],
        ['wizExplorer.navigateNext', () => navigationManager.navigateFile('next')],
        ['wizExplorer.openInSplit', () => navigationManager.openCurrentInSplit()],

        // App Menu
        ['wizExplorer.showAppMenu', () => navigationManager.showAppMenu()],

        // Project switching
        ['wizExplorer.switchProject', async () => {
            const result = await projectManager.showProjectMenu(currentProject);
            if (!result) return;

            if (result.action === 'switch' && result.projectName) {
                currentProject = result.projectName;
                updateProjectRoot();
            } else if (result.action === 'delete' && result.projectName && result.projectName !== currentProject) {
                currentProject = result.projectName;
                updateProjectRoot();
            } else if ((result.action === 'import' || result.action === 'importFile') && result.projectName) {
                currentProject = result.projectName;
                updateProjectRoot();
            }
        }],
        ['wizExplorer.copyProjectName', async () => {
            const displayProjectName = resolveProjectNameCase(workspaceRoot, currentProject);
            try {
                await vscode.env.clipboard.writeText(displayProjectName);
                vscode.window.showInformationMessage(`프로젝트명이 복사되었습니다: ${displayProjectName}`);
            } catch (e) {
                vscode.window.showWarningMessage(`클립보드 복사 실패: ${displayProjectName}`);
            }
        }],

        // New App
        ['wizExplorer.newApp', async (node) => {
            if (node?.contextValue === 'appGroup') {
                // Standard App (page, component, widget, layout)
                await sourceManager.createApp(node.groupType, node.parentPath);
            } else if (node?.contextValue === 'portalAppGroup') {
                // Portal App
                await packageManager.createPortalApp(node.resourceUri.fsPath);
            } else if (node?.contextValue === 'routeGroup') {
                // Standard Route
                await sourceManager.createRoute(node.resourceUri.fsPath);
            } else if (node?.contextValue === 'portalRouteGroup') {
                // Portal Route
                await packageManager.createPortalRoute(node.resourceUri.fsPath);
            }
        }],

        // Upload App
        ['wizExplorer.uploadApp', async (node) => {
            if (!node) {
                vscode.window.showErrorMessage('앱 그룹을 선택해주세요.');
                return;
            }

            const isPortalApp = node.contextValue === 'portalAppGroup';
            const parentPath = isPortalApp ? node.resourceUri.fsPath : node.parentPath;
            
            if (isPortalApp) {
                await packageManager.showPortalAppUploadWebview(parentPath);
            } else {
                await sourceManager.showUploadWebview(parentPath);
            }
        }],

        // Upload Package
        ['wizExplorer.uploadPackage', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }

            await packageManager.showPackageUploadWebview();
        }],

        // New Package (Portal)
        ['wizExplorer.newPackage', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }
            await packageManager.createPackage();
        }],

        // Export Package
        ['wizExplorer.exportPackage', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('패키지를 선택해주세요.');
                return;
            }
            await packageManager.exportPackage(node.resourceUri.fsPath);
        }],

        // Copy Template
        ['wizExplorer.copyTemplate', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('앱을 선택해주세요.');
                return;
            }
            await navigationManager.copyTemplate(node.resourceUri.fsPath);
        }],

        // File operations
        ['wizExplorer.newFile', async (node) => {
            await fileManager.createFile(node?.resourceUri?.fsPath);
        }],

        ['wizExplorer.newFolder', async (node) => {
            await fileManager.createFolder(node?.resourceUri?.fsPath);
        }],

        ['wizExplorer.delete', async (node) => {
            if (!node) return;
            await fileManager.delete(node.resourceUri.fsPath, {
                onDeleted: (deletedPath) => {
                    if (appEditorProvider.currentAppPath === deletedPath) {
                        appEditorProvider.currentWebviewPanel?.dispose();
                    }
                }
            });
        }],

        ['wizExplorer.copy', (node) => {
            if (node) {
                fileManager.copy(node.resourceUri.fsPath);
            }
        }],

        ['wizExplorer.rename', async (node) => {
            if (!node || !node.resourceUri) return;
            await fileManager.rename(node.resourceUri.fsPath, {
                isPortalPackage: node.contextValue === 'portalPackage'
            });
        }],

        ['wizExplorer.downloadFile', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('다운로드할 파일을 선택해주세요.');
                return;
            }
            await fileManager.download(node.resourceUri.fsPath, {
                contextValue: node.contextValue
            });
        }],

        ['wizExplorer.uploadFile', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('업로드할 폴더를 선택해주세요.');
                return;
            }
            await fileManager.upload(node.resourceUri.fsPath, context);
        }],

        ['wizExplorer.paste', async (node) => {
            await fileManager.paste(node?.resourceUri?.fsPath);
        }],

        ['wizExplorer.openFile', (resource) => {
            if (resource && !resource.isDirectory) {
                vscode.commands.executeCommand('vscode.open', resource.resourceUri);
            }
        }],

        ['wizExplorer.revealInExplorer', (resource) => {
            if (resource) {
                vscode.commands.executeCommand('revealFileInOS', resource.resourceUri);
            }
        }],

        ['wizExplorer.openFolder', async () => {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: '폴더 열기'
            });
            
            if (uri?.[0]) {
                await vscode.commands.executeCommand('vscode.openFolder', uri[0]);
            }
        }],

        // Deprecated (kept for compatibility)
        ['wizExplorer.switchAppFile', async () => {}],
        ['wizExplorer.toggleAppFile', async () => {}],

        // ==================== Command Palette Commands ====================
        
        // Direct build commands (without menu selection)
        ['wizExplorer.normalBuild', () => buildManager.normalBuild()],
        ['wizExplorer.cleanBuild', async () => {
            const choice = await vscode.window.showWarningMessage(
                'Clean Build를 실행하시겠습니까? 기존 빌드를 삭제 후 재빌드하므로 시간이 오래 걸릴 수 있습니다.',
                { modal: true },
                '실행'
            );
            if (choice === '실행') {
                buildManager.cleanBuild();
            }
        }],
        ['wizExplorer.showBuildOutput', () => buildManager.showOutput()],

        // Export current project directly
        ['wizExplorer.exportCurrentProject', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }
            await projectManager.exportProject(currentProject);
        }],

        // Import project file (.wizproject)
        ['wizExplorer.importProject', async () => {
            if (!workspaceRoot) {
                vscode.window.showInformationMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            projectManager.ensureProjectFolder();

            const filePath = await projectManager.selectProjectFile();
            if (!filePath) return;

            const projectName = await projectManager.promptProjectName({
                title: '새 프로젝트 이름(Namespace) 입력',
                value: path.basename(filePath, '.wizproject')
            });
            if (!projectName) return;

            const success = await projectManager.importFromFile(filePath, projectName);
            if (success) {
                const choice = await vscode.window.showInformationMessage(
                    `프로젝트 '${projectName}'를 성공적으로 가져왔습니다. 전환하시겠습니까?`,
                    '예', '아니오'
                );
                if (choice === '예') {
                    currentProject = projectName;
                    updateProjectRoot();
                }
            }
        }],

        // Go to App (search by name)
        ['wizExplorer.goToApp', () => navigationManager.goToApp()],

        // Open App Info for current file
        ['wizExplorer.openAppInfo', () => {
            const dirPath = navigationManager.resolveCurrentAppPath();
            if (!dirPath) {
                vscode.window.showWarningMessage('현재 열린 앱 파일이 없습니다.');
                return;
            }
            appEditorProvider.openInfoEditor(dirPath, appContextListener);
        }],

        // Copy template of current app
        ['wizExplorer.copyCurrentTemplate', () => {
            const dirPath = navigationManager.resolveCurrentAppPath();
            navigationManager.copyTemplate(dirPath);
        }],

        // Reveal current file in Wiz Explorer
        ['wizExplorer.revealInWizExplorer', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('열린 파일이 없습니다.');
                return;
            }

            const uri = editor.document.uri;
            let filePath;

            if (uri.scheme === 'file') {
                filePath = uri.fsPath;
            } else if (uri.scheme === 'wiz') {
                filePath = WizPathUtils.getRealPathFromUri(uri);
            }

            if (filePath) {
                try {
                    const item = await fileExplorerProvider.findItem(filePath);
                    if (item) {
                        treeView.reveal(item, { select: true, focus: true, expand: true });
                    }
                } catch (e) {
                    vscode.window.showWarningMessage('Wiz Explorer에서 항목을 찾을 수 없습니다.');
                }
            }
        }],

        // Current Project info (for agent mode / command palette)
        ['wizExplorer.currentProject', () => {
            if (!workspaceRoot) {
                vscode.window.showWarningMessage('워크스페이스가 열려있지 않습니다.');
                return null;
            }
            const projectPath = path.join(workspaceRoot, 'project', currentProject);
            const info = {
                project: currentProject,
                projectPath: projectPath,
                workspaceRoot: workspaceRoot
            };
            vscode.window.showInformationMessage(`현재 Wiz 프로젝트: ${currentProject}`);
            return info;
        }],

        // Create App shortcuts from command palette
        ['wizExplorer.createPage', async () => {
            const location = await navigationManager.selectAppLocation('page');
            if (!location) return;
            
            if (location.type === 'source') {
                await sourceManager.createApp('page', location.path);
            } else {
                await packageManager.createPortalApp(location.path);
            }
        }],

        ['wizExplorer.createComponent', async () => {
            const location = await navigationManager.selectAppLocation('component');
            if (!location) return;
            
            if (location.type === 'source') {
                await sourceManager.createApp('component', location.path);
            } else {
                await packageManager.createPortalApp(location.path);
            }
        }],

        ['wizExplorer.createLayout', async () => {
            const location = await navigationManager.selectAppLocation('layout');
            if (!location) return;
            
            if (location.type === 'source') {
                await sourceManager.createApp('layout', location.path);
            } else {
                await packageManager.createPortalApp(location.path);
            }
        }],

        ['wizExplorer.createRoute', async () => {
            const location = await navigationManager.selectRouteLocation();
            if (!location) return;
            
            if (location.type === 'package') {
                await packageManager.createPortalRoute(location.path);
            } else {
                await sourceManager.createRoute(location.path);
            }
        }]
    ];

    commands.forEach(([id, handler]) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(id, handler)
        );
    });
}

function deactivate() {}

module.exports = { activate, deactivate };
