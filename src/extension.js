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
    const fileExplorerProvider = new FileExplorerProvider(undefined, context.extensionPath);

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
        getCurrentProject: () => currentProject
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

    // ==================== Workspace State Sync ====================
    function updateProjectRoot() {
        if (!workspaceRoot) {
            fileExplorerProvider.workspaceRoot = undefined;
            fileExplorerProvider.wizRoot = undefined;
            fileExplorerProvider.refresh();
            return;
        }

        const projectPath = path.join(workspaceRoot, 'project', currentProject);
        fileExplorerProvider.workspaceRoot = projectPath;
        fileExplorerProvider.wizRoot = workspaceRoot;
        fileExplorerProvider.refresh();
        
        if (treeView) {
            treeView.title = currentProject;
        }

        // Service managers 상태 동기화
        sourceManager.workspaceRoot = fileExplorerProvider.workspaceRoot;
        packageManager.workspaceRoot = fileExplorerProvider.workspaceRoot;
        packageManager.wizRoot = fileExplorerProvider.wizRoot;
        packageManager.currentProject = currentProject;
        projectManager.wizRoot = workspaceRoot;

        // 프로젝트 전환 시 편집 추적 초기화
        buildManager.clearEditedDocuments();
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

        // MCP Server commands
        ['wizExplorer.startMcpServer', () => mcpManager.start()],
        ['wizExplorer.stopMcpServer', () => mcpManager.stop()],
        ['wizExplorer.showMcpConfig', () => mcpManager.showConfig()],
        
        // Build command
        ['wizExplorer.build', () => buildManager.showBuildMenu()],
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
        ['wizExplorer.cleanBuild', () => buildManager.cleanBuild()],
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
