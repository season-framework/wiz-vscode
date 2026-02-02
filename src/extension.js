/**
 * Wiz VSCode Extension (Refactored)
 * 확장 프로그램 진입점
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const util = require('util');
const exec = util.promisify(cp.exec);

const FileExplorerProvider = require('./explorer/fileExplorerProvider');
const AppEditorProvider = require('./editor/appEditorProvider');
const AppContextListener = require('./editor/appContextListener');
const WizFileSystemProvider = require('./editor/wizFileSystemProvider');
const { WizPathUtils, WizFileUtils, WizUriFactory, FILE_TYPE_MAPPING, APP_TEMPLATES } = require('./core');

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
    }

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            updateProjectRoot();
        })
    );

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
                            treeView.reveal(item, { select: true, focus: false, expand: true });
                        }
                    } catch (e) {
                        // Ignore reveal errors
                    }
                }
            }
        })
    );


    // ==================== File Switching ====================
    async function switchFile(type) {
        let dirPath = resolveCurrentAppPath();
        if (!dirPath) return;

        // INFO 탭은 Webview로 처리
        if (type === 'info') {
            appEditorProvider.openInfoEditor(dirPath, appContextListener);
            return;
        }

        const files = WizFileUtils.readAppFiles(dirPath);
        const target = files[type];
        
        if (!target) {
            vscode.window.setStatusBarMessage(`Invalid file type: ${type}`, 3000);
            return;
        }

        // 파일이 없으면 생성
        if (!target.exists) {
            if (!WizFileUtils.safeWriteFile(target.fullPath, '')) {
                vscode.window.showErrorMessage(`파일 생성 실패`);
                return;
            }
        }

        const wizUri = WizUriFactory.fromAppPath(dirPath, target.fullPath, target.label);
        const doc = await vscode.workspace.openTextDocument(wizUri);
        
        const language = WizFileUtils.getLanguageFromExtension(target.fullPath);
        if (language) {
            vscode.languages.setTextDocumentLanguage(doc, language);
        }

        appEditorProvider.closeWebview?.() || (appEditorProvider.currentWebviewPanel?.dispose());
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
    }

    function resolveCurrentAppPath() {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const uri = editor.document.uri;
            if (uri.scheme === 'wiz') {
                const realPath = WizPathUtils.getRealPathFromUri(uri);
                return realPath ? path.dirname(realPath) : null;
            } else if (uri.scheme === 'file') {
                return path.dirname(uri.fsPath);
            }
        }

        // Webview가 활성화된 경우
        if (appEditorProvider.activeEditor?.panel?.active) {
            return appEditorProvider.activeEditor.appPath;
        }

        return null;
    }

    // ==================== Build Trigger ====================
    const buildOutputChannel = vscode.window.createOutputChannel('Wiz Build');
    let buildProcess = null;
    
    // ANSI 색상 코드 제거 함수
    function stripAnsi(str) {
        return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    }
    
    function triggerBuild(clean = false) {
        if (!currentProject) return;
        
        // 이전 빌드 프로세스가 실행 중이면 종료
        if (buildProcess) {
            buildProcess.kill();
            buildProcess = null;
        }
        
        const buildType = clean ? 'Clean Build' : 'Build';
        buildOutputChannel.show(true);
        buildOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${buildType} project: ${currentProject}...`);
        
        const args = ['project', 'build', '--project', currentProject];
        if (clean) {
            args.push('--clean');
        }
        
        buildProcess = cp.spawn('wiz', args, {
            cwd: workspaceRoot,
            shell: true,
            env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
        });
        
        buildProcess.stdout.on('data', (data) => {
            buildOutputChannel.append(stripAnsi(data.toString()));
        });
        
        buildProcess.stderr.on('data', (data) => {
            buildOutputChannel.append(stripAnsi(data.toString()));
        });
        
        buildProcess.on('close', (code) => {
            buildOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Build finished with code ${code}`);
            buildProcess = null;
        });
        
        buildProcess.on('error', (err) => {
            buildOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Build error: ${err.message}`);
            buildProcess = null;
        });
    }

    // Inject build trigger to AppEditorProvider
    appEditorProvider.onFileSaved = () => triggerBuild(false);

    // ==================== App Creation Functions ====================
    async function createStandardApp(groupType, parentPath, fileExplorerProvider) {
        const capitalizedType = groupType.charAt(0).toUpperCase() + groupType.slice(1);
        
        // 1. Namespace 입력
        const namespace = await vscode.window.showInputBox({
            title: `새 ${capitalizedType} 생성`,
            prompt: 'Namespace를 입력하세요',
            placeHolder: 'myapp',
            validateInput: (value) => {
                if (!value) return 'Namespace는 필수입니다.';
                if (!/^[a-z][a-z0-9_]*$/.test(value)) {
                    return '영문 소문자로 시작하고, 소문자/숫자/밑줄만 허용됩니다.';
                }
                const appID = `${groupType}.${value}`;
                const appPath = path.join(parentPath, appID);
                if (fs.existsSync(appPath)) {
                    return '이미 존재하는 앱입니다.';
                }
                return null;
            }
        });
        if (!namespace) return;

        // 2. Title 입력 (선택)
        const title = await vscode.window.showInputBox({
            title: 'Title (선택사항)',
            prompt: '앱의 표시 이름을 입력하세요. 비워두면 namespace를 사용합니다.',
            placeHolder: namespace
        });

        // 3. Category 입력 (선택)
        const category = await vscode.window.showInputBox({
            title: 'Category (선택사항)',
            prompt: '카테고리를 입력하세요.',
            placeHolder: namespace
        });

        // 4. Controller 선택 (선택)
        const controllerDir = path.join(fileExplorerProvider.workspaceRoot, 'src', 'controller');
        const controllers = WizPathUtils.loadControllers(controllerDir);
        let controller = '';
        
        if (controllers.length > 0) {
            const controllerItems = [
                { label: '$(dash) 없음', value: '' },
                ...controllers.map(c => ({ label: `$(symbol-method) ${c}`, value: c }))
            ];
            const selectedController = await vscode.window.showQuickPick(controllerItems, {
                title: 'Controller 선택 (선택사항)',
                placeHolder: '사용할 Controller를 선택하세요'
            });
            if (selectedController) {
                controller = selectedController.value;
            }
        }

        // 5. Page 전용: Layout 선택 및 ViewURI 입력
        let layout = '';
        let viewuri = '';
        
        if (groupType === 'page') {
            // Layout 선택
            const layouts = WizPathUtils.loadLayouts(parentPath);
            if (layouts.length > 0) {
                const layoutItems = [
                    { label: '$(dash) 없음', value: '' },
                    ...layouts.map(l => ({ label: `$(layout) ${l}`, value: l }))
                ];
                const selectedLayout = await vscode.window.showQuickPick(layoutItems, {
                    title: 'Layout 선택 (선택사항)',
                    placeHolder: '사용할 Layout을 선택하세요'
                });
                if (selectedLayout) {
                    layout = selectedLayout.value;
                }
            }

            // ViewURI (Angular Routing) 입력
            viewuri = await vscode.window.showInputBox({
                title: 'Angular Routing (선택사항)',
                prompt: 'ViewURI를 입력하세요.',
                placeHolder: '/example'
            }) || '';
        }

        // 앱 생성
        const appID = `${groupType}.${namespace}`;
        const newAppPath = path.join(parentPath, appID);

        try {
            fs.mkdirSync(newAppPath, { recursive: true });

            const appJson = {
                id: appID,
                mode: groupType,
                title: title || namespace,
                namespace: namespace,
                category: category || namespace,
                viewuri: viewuri,
                preview: '',
                controller: controller,
                layout: layout
            };

            WizFileUtils.safeWriteJson(path.join(newAppPath, 'app.json'), appJson);
            
            // 기본 템플릿 파일 생성
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.html'), APP_TEMPLATES['view.html']);
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.ts'), APP_TEMPLATES['view.ts']);
            
            vscode.window.showInformationMessage(`${capitalizedType} '${appID}' 생성 완료`);
            fileExplorerProvider?.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`앱 생성 실패: ${e.message}`);
        }
    }

    async function createPortalApp(parentPath, fileExplorerProvider) {
        // 1. Namespace 입력
        const namespace = await vscode.window.showInputBox({
            title: '새 Portal App 생성',
            prompt: 'Namespace를 입력하세요',
            placeHolder: 'myapp',
            validateInput: (value) => {
                if (!value) return 'Namespace는 필수입니다.';
                if (!/^[a-z][a-z0-9_]*$/.test(value)) {
                    return '영문 소문자로 시작하고, 소문자/숫자/밑줄만 허용됩니다.';
                }
                const appPath = path.join(parentPath, value);
                if (fs.existsSync(appPath)) {
                    return '이미 존재하는 앱입니다.';
                }
                return null;
            }
        });
        if (!namespace) return;

        // 2. Title 입력 (선택)
        const title = await vscode.window.showInputBox({
            title: 'Title (선택사항)',
            prompt: '앱의 표시 이름을 입력하세요. 비워두면 namespace를 사용합니다.',
            placeHolder: namespace
        });

        // 3. Category 입력 (선택)
        const category = await vscode.window.showInputBox({
            title: 'Category (선택사항)',
            prompt: '카테고리를 입력하세요.',
            placeHolder: 'editor',
            value: 'editor'
        });

        // 4. Controller 선택 (선택)
        const packagePath = path.dirname(parentPath);
        const packageName = path.basename(packagePath);
        const controllerDir = path.join(packagePath, 'controller');
        const controllers = WizPathUtils.loadControllers(controllerDir);
        let controller = '';
        
        if (controllers.length > 0) {
            const controllerItems = [
                { label: '$(dash) 없음', value: '' },
                ...controllers.map(c => ({ label: `$(symbol-method) ${c}`, value: c }))
            ];
            const selectedController = await vscode.window.showQuickPick(controllerItems, {
                title: 'Controller 선택 (선택사항)',
                placeHolder: '사용할 Controller를 선택하세요'
            });
            if (selectedController) {
                controller = selectedController.value;
            }
        }

        // 앱 생성
        const appID = namespace;
        const newAppPath = path.join(parentPath, appID);

        try {
            fs.mkdirSync(newAppPath, { recursive: true });

            const appJson = {
                id: appID,
                mode: 'portal',
                title: title || namespace,
                namespace: namespace,
                category: category || 'editor',
                viewuri: '',
                controller: controller,
                template: `wiz-portal-${packageName}-${namespace.replace(/\./g, '-')}`
            };

            WizFileUtils.safeWriteJson(path.join(newAppPath, 'app.json'), appJson);
            
            // 기본 템플릿 파일 생성
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.html'), APP_TEMPLATES['view.html']);
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.ts'), APP_TEMPLATES['view.ts']);
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.scss'), APP_TEMPLATES['view.scss']);

            vscode.window.showInformationMessage(`Portal App '${appID}' 생성 완료`);
            fileExplorerProvider?.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`앱 생성 실패: ${e.message}`);
        }
    }

    async function createRoute(parentPath, isPortalRoute, fileExplorerProvider) {
        const routeType = isPortalRoute ? 'Portal Route' : 'Route';
        
        // 1. ID 입력
        const id = await vscode.window.showInputBox({
            title: `새 ${routeType} 생성`,
            prompt: 'ID (폴더명)를 입력하세요',
            placeHolder: 'myroute',
            validateInput: (value) => {
                if (!value) return 'ID는 필수입니다.';
                if (!/^[a-z][a-z0-9]*$/.test(value)) {
                    return '영문 소문자로 시작하고, 소문자/숫자만 허용됩니다.';
                }
                const routePath = path.join(parentPath, value);
                if (fs.existsSync(routePath)) {
                    return '이미 존재하는 라우트입니다.';
                }
                return null;
            }
        });
        if (!id) return;

        // 2. Title 입력 (선택)
        const title = await vscode.window.showInputBox({
            title: 'Title (선택사항)',
            prompt: '라우트의 표시 이름을 입력하세요.',
            placeHolder: id
        });

        // 3. Route Path 입력
        const routePath = await vscode.window.showInputBox({
            title: 'Route Path',
            prompt: 'API 경로를 입력하세요.',
            placeHolder: '/api/example'
        });

        // 라우트 생성
        const newRoutePath = path.join(parentPath, id);

        try {
            fs.mkdirSync(newRoutePath, { recursive: true });

            const appJson = {
                id: id,
                title: title || id,
                route: routePath || '',
                category: '',
                viewuri: '',
                controller: ''
            };

            WizFileUtils.safeWriteJson(path.join(newRoutePath, 'app.json'), appJson);
            WizFileUtils.safeWriteFile(path.join(newRoutePath, 'controller.py'), '');

            vscode.window.showInformationMessage(`${routeType} '${id}' 생성 완료`);
            fileExplorerProvider?.refresh();
        } catch (e) {
            vscode.window.showErrorMessage(`라우트 생성 실패: ${e.message}`);
        }
    }

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        if (!currentProject) return;
        
        const uri = document.uri;
        
        // wiz:// 스킴 파일도 빌드 트리거 동작
        if (uri.scheme === 'wiz') {
            triggerBuild();
            return;
        }
        
        // 일반 file 스킴은 워크스페이스 경로 체크
        if (uri.scheme === 'file') {
            if (workspaceRoot && !uri.fsPath.startsWith(workspaceRoot)) return;
            triggerBuild();
        }
    }));

    // ==================== Commands Registration ====================
    const commands = [
        // Core commands
        ['wizExplorer.refresh', () => fileExplorerProvider.refresh()],
        ['wizExplorer.openAppEditor', (appPath, groupType) => appEditorProvider.openEditor(appPath, groupType)],
        ['wizExplorer.openPortalInfo', (portalJsonPath) => appEditorProvider.openPortalInfoEditor(portalJsonPath)],
        
        // Build command
        ['wizExplorer.build', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }

            const buildOptions = [
                { label: '$(tools) Normal Build', description: '현재 상태에서 빌드', value: false },
                { label: '$(trash) Clean Build', description: '기존 빌드 결과물 삭제 후 빌드', value: true }
            ];

            const selected = await vscode.window.showQuickPick(buildOptions, {
                title: '빌드 타입 선택',
                placeHolder: '빌드 방식을 선택하세요'
            });

            if (selected) {
                triggerBuild(selected.value);
            }
        }],
        
        // File switch commands
        ['wizExplorer.switch.info', () => switchFile('info')],
        ['wizExplorer.switch.controller', () => switchFile('controller')],
        ['wizExplorer.switch.ui', () => switchFile('ui')],
        ['wizExplorer.switch.component', () => switchFile('component')],
        ['wizExplorer.switch.scss', () => switchFile('scss')],
        ['wizExplorer.switch.api', () => switchFile('api')],
        ['wizExplorer.switch.socket', () => switchFile('socket')],
        
        // Active state commands (same behavior)
        ['wizExplorer.switch.info.active', () => switchFile('info')],
        ['wizExplorer.switch.controller.active', () => switchFile('controller')],
        ['wizExplorer.switch.ui.active', () => switchFile('ui')],
        ['wizExplorer.switch.component.active', () => switchFile('component')],
        ['wizExplorer.switch.scss.active', () => switchFile('scss')],
        ['wizExplorer.switch.api.active', () => switchFile('api')],
        ['wizExplorer.switch.socket.active', () => switchFile('socket')],

        // App Menu
        ['wizExplorer.showAppMenu', async () => {
            const dirPath = resolveCurrentAppPath();
            if (!dirPath) return;
            
            const files = WizFileUtils.readAppFiles(dirPath);
            const items = Object.entries(files)
                .filter(([_, v]) => v.exists)
                .map(([key, val]) => ({
                    label: `${val.icon} ${key.toUpperCase()}`,
                    description: val.fileName,
                    type: key
                }));
            
            const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Switch to...' });
            if (selected) {
                switchFile(selected.type);
            }
        }],

        // Project switching
        ['wizExplorer.switchProject', async () => {
            if (!workspaceRoot) {
                vscode.window.showInformationMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            const projectBasePath = path.join(workspaceRoot, 'project');
            if (!fs.existsSync(projectBasePath)) {
                try {
                    fs.mkdirSync(projectBasePath, { recursive: true });
                } catch (e) {
                    vscode.window.showErrorMessage(`'project' 폴더를 생성할 수 없습니다.`);
                    return;
                }
            }

            const projects = fs.readdirSync(projectBasePath)
                .filter(item => {
                    try {
                        return fs.statSync(path.join(projectBasePath, item)).isDirectory();
                    } catch (e) { return false; }
                });

            const items = [
                { label: '$(cloud-download) 프로젝트 불러오기 (Git)', description: 'Git 저장소 복제', action: 'import' },
                { label: '$(file-zip) 프로젝트 파일 불러오기 (.wizproject)', description: '로컬 파일에서 생성', action: 'importFile' },
                { label: '$(package) 프로젝트 내보내기', description: 'exports 폴더로 내보내기', action: 'export' },
                { label: '$(trash) 프로젝트 삭제하기', description: '로컬 프로젝트 폴더 삭제', action: 'delete' },
                { label: '', kind: vscode.QuickPickItemKind.Separator },
                ...projects.map(p => ({ label: `$(folder) ${p}`, action: 'switch', projectName: p }))
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '프로젝트 선택 또는 관리',
                title: '프로젝트 전환'
            });

            if (!selected) return;

            if (selected.action === 'switch') {
                currentProject = selected.projectName;
                updateProjectRoot();
            } else if (selected.action === 'delete') {
                const projectToDelete = await vscode.window.showQuickPick(projects, {
                    placeHolder: '삭제할 프로젝트 선택 (주의: 실행 즉시 삭제됩니다)',
                    title: '프로젝트 삭제'
                });

                if (!projectToDelete) return;

                const confirm = await vscode.window.showWarningMessage(
                    `경고: 프로젝트 '${projectToDelete}'와(과) 포함된 모든 파일이 영구적으로 삭제됩니다. 계속하시겠습니까?`,
                    '삭제', '취소'
                );

                if (confirm !== '삭제') return;

                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `프로젝트 '${projectToDelete}' 삭제 중...`,
                    cancellable: false
                }, async () => {
                    try {
                        const targetPath = path.join(projectBasePath, projectToDelete);
                        // Using rm -rf implementation
                        fs.rmSync(targetPath, { recursive: true, force: true });
                        vscode.window.showInformationMessage(`프로젝트 '${projectToDelete}'가 삭제되었습니다.`);
                        
                        // If deleted project was active, switch to another or clear
                        if (currentProject === projectToDelete) {
                             currentProject = 'main'; // Fallback or handle appropriately
                             // Check if main exists, if not pick first available, else none
                             if (!fs.existsSync(path.join(projectBasePath, 'main'))) {
                                 // Simple re-check
                                 const remaining = fs.readdirSync(projectBasePath).filter(f =>  fs.statSync(path.join(projectBasePath, f)).isDirectory());
                                 currentProject = remaining.length > 0 ? remaining[0] : null;
                             }
                             updateProjectRoot();
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`프로젝트 삭제 실패: ${err.message}`);
                    }
                });

            } else if (selected.action === 'export') {
                // Export Project
                const projectToExport = await vscode.window.showQuickPick(projects, {
                    placeHolder: '내보낼 프로젝트 선택',
                    title: '프로젝트 내보내기'
                });

                if (!projectToExport) return;

                // exports 폴더 경로 설정
                const exportsPath = path.join(fileExplorerProvider.wizRoot, 'exports');
                if (!fs.existsSync(exportsPath)) {
                    fs.mkdirSync(exportsPath, { recursive: true });
                }

                const outputPath = path.join(exportsPath, projectToExport);

                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `프로젝트 '${projectToExport}' 내보내는 중...`,
                    cancellable: false
                }, async () => {
                    try {
                        const command = `wiz project export --project=${projectToExport} --output="${outputPath}"`;
                        buildOutputChannel.appendLine(`[Export] ${command}`);
                        buildOutputChannel.show(true);

                        await exec(command, { cwd: fileExplorerProvider.wizRoot });

                        buildOutputChannel.appendLine(`[Export] 완료: ${outputPath}`);
                        vscode.window.showInformationMessage(`프로젝트 '${projectToExport}'가 exports 폴더로 내보내졌습니다.`);
                        
                        // Refresh to show in Exports category
                        fileExplorerProvider.refresh();
                    } catch (err) {
                        buildOutputChannel.appendLine(`[Export] 실패: ${err.message}`);
                        vscode.window.showErrorMessage(`프로젝트 내보내기 실패: ${err.message}`);
                    }
                });

            } else if (selected.action === 'importFile') {
                // 1. Select .wizproject file
                const fileUris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: { 'Wiz Project': ['wizproject'] },
                    title: 'Wiz 프로젝트 파일 선택'
                });

                if (!fileUris || fileUris.length === 0) return;
                const filePath = fileUris[0].fsPath;

                // 2. Input Project Name (Namespace)
                const projectName = await vscode.window.showInputBox({
                    title: '새 프로젝트 이름(Namespace) 입력',
                    prompt: '영문 소문자와 숫자만 허용됩니다.',
                    value: path.basename(filePath, '.wizproject'),
                    validateInput: (value) => {
                        if (!/^[a-z0-9]+$/.test(value)) {
                            return '영문 소문자와 숫자만 허용됩니다.';
                        }
                        if (fs.existsSync(path.join(projectBasePath, value))) {
                            return '이미 존재하는 프로젝트 이름입니다.';
                        }
                        return null;
                    }
                });

                if (!projectName) return;

                // 3. Unzip to project folder
                const targetPath = path.join(projectBasePath, projectName);
                
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: `프로젝트 '${projectName}' 가져오는 중...`,
                        cancellable: false
                    }, async () => {
                        // Create target directory
                        fs.mkdirSync(targetPath, { recursive: true });
                        
                        // Unzip file to target path
                        const command = `unzip -o "${filePath}" -d "${targetPath}"`;
                        buildOutputChannel.appendLine(`[Import] ${command}`);
                        buildOutputChannel.show(true);

                        await exec(command);

                        buildOutputChannel.appendLine(`[Import] 완료: ${targetPath}`);
                    });
                    
                    const choice = await vscode.window.showInformationMessage(
                        `프로젝트 '${projectName}'를 성공적으로 가져왔습니다. 전환하시겠습니까?`,
                        '예', '아니오'
                    );
                    
                    if (choice === '예') {
                        currentProject = projectName;
                        updateProjectRoot();
                    }
                } catch (err) {
                    // 실패 시 생성된 폴더 정리
                    if (fs.existsSync(targetPath)) {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                    }
                    buildOutputChannel.appendLine(`[Import] 실패: ${err.message}`);
                    vscode.window.showErrorMessage(`프로젝트 가져오기 실패: ${err.message}`);
                }

            } else if (selected.action === 'import') {
                // 1. Input Project Name
                const projectName = await vscode.window.showInputBox({
                    title: '새 프로젝트 이름 입력',
                    prompt: '영문 소문자와 숫자만 허용됩니다.',
                    placeHolder: 'projectname',
                    validateInput: (value) => {
                        if (!/^[a-z0-9]+$/.test(value)) {
                            return '영문 소문자와 숫자만 허용됩니다.';
                        }
                        if (fs.existsSync(path.join(projectBasePath, value))) {
                            return '이미 존재하는 프로젝트 이름입니다.';
                        }
                        return null;
                    }
                });

                if (!projectName) return;

                // 2. Input Git URL
                const gitUrl = await vscode.window.showInputBox({
                    title: 'Git 저장소 주소 입력',
                    prompt: '복제할 Git 리포지토리의 URL을 입력하세요.',
                    placeHolder: 'https://github.com/username/repo.git',
                    ignoreFocusOut: true
                });

                if (!gitUrl) return;

                // 3. Clone
                const targetPath = path.join(projectBasePath, projectName);
                
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `프로젝트 '${projectName}' 불러오는 중...`,
                    cancellable: false
                }, async (progress) => {
                    try {
                        await exec(`git clone "${gitUrl}" "${targetPath}"`);
                        
                        const choice = await vscode.window.showInformationMessage(
                            `프로젝트 '${projectName}'를 성공적으로 불러왔습니다. 전환하시겠습니까?`,
                            '예', '아니오'
                        );
                        
                        if (choice === '예') {
                            currentProject = projectName;
                            updateProjectRoot();
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`프로젝트 불러오기 실패: ${err.message}`);
                    }
                });
            }
        }],

        // New App
        ['wizExplorer.newApp', async (node) => {
            if (node?.contextValue === 'appGroup') {
                // Standard App (page, component, widget, layout)
                await createStandardApp(node.groupType, node.parentPath, fileExplorerProvider);
            } else if (node?.contextValue === 'portalAppGroup') {
                // Portal App
                await createPortalApp(node.resourceUri.fsPath, fileExplorerProvider);
            } else if (node?.contextValue === 'routeGroup') {
                // Standard Route
                await createRoute(node.resourceUri.fsPath, false, fileExplorerProvider);
            } else if (node?.contextValue === 'portalRouteGroup') {
                // Portal Route
                await createRoute(node.resourceUri.fsPath, true, fileExplorerProvider);
            }
        }],

        // New Package (Portal)
        ['wizExplorer.newPackage', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }

            const namespace = await vscode.window.showInputBox({
                title: '새 패키지 생성',
                prompt: '패키지 이름을 입력하세요 (영문 소문자와 숫자만 허용)',
                placeHolder: 'mypackage',
                validateInput: (value) => {
                    if (!value) return '패키지 이름은 필수입니다.';
                    if (!/^[a-z][a-z0-9]*$/.test(value)) {
                        return '영문 소문자로 시작하고 영문 소문자와 숫자만 허용됩니다.';
                    }
                    const portalPath = path.join(fileExplorerProvider.workspaceRoot, 'src', 'portal', value);
                    if (fs.existsSync(portalPath)) {
                        return '이미 존재하는 패키지 이름입니다.';
                    }
                    return null;
                }
            });

            if (!namespace) return;

            const title = await vscode.window.showInputBox({
                title: '패키지 타이틀 (선택사항)',
                prompt: '패키지의 표시 이름을 입력하세요. 비워두면 namespace를 사용합니다.',
                placeHolder: namespace.toUpperCase()
            });

            buildOutputChannel.show(true);
            buildOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Creating package: ${namespace}...`);

            const createProcess = cp.spawn('wiz', [
                'project', 'package', 'create',
                `--namespace=${namespace}`,
                `--project=${currentProject}`,
                ...(title ? [`--title=${title}`] : [])
            ], {
                cwd: workspaceRoot,
                shell: true,
                env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }
            });

            createProcess.stdout.on('data', (data) => {
                buildOutputChannel.append(stripAnsi(data.toString()));
            });

            createProcess.stderr.on('data', (data) => {
                buildOutputChannel.append(stripAnsi(data.toString()));
            });

            createProcess.on('close', (code) => {
                if (code === 0) {
                    vscode.window.showInformationMessage(`패키지 '${namespace}'가 생성되었습니다.`);
                    fileExplorerProvider.refresh();
                } else {
                    vscode.window.showErrorMessage(`패키지 생성 실패 (code: ${code})`);
                }
                buildOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Package creation finished with code ${code}`);
            });

            createProcess.on('error', (err) => {
                vscode.window.showErrorMessage(`패키지 생성 오류: ${err.message}`);
                buildOutputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Package creation error: ${err.message}`);
            });
        }],

        // Export Package
        ['wizExplorer.exportPackage', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('패키지를 선택해주세요.');
                return;
            }

            const packagePath = node.resourceUri.fsPath;
            const packageName = path.basename(packagePath);
            const archiver = require('archiver');
            
            // wiz 루트의 exports 폴더에 파일 생성
            const exportsDir = path.join(workspaceRoot, 'exports');
            if (!fs.existsSync(exportsDir)) {
                fs.mkdirSync(exportsDir, { recursive: true });
            }
            const outputPath = path.join(exportsDir, `${packageName}.wizpkg`);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `패키지 '${packageName}' 내보내는 중...`,
                cancellable: false
            }, async () => {
                return new Promise((resolve, reject) => {
                    const output = fs.createWriteStream(outputPath);
                    const archive = archiver('zip', { zlib: { level: 9 } });

                    output.on('close', () => {
                        resolve();
                    });

                    archive.on('error', (err) => {
                        vscode.window.showErrorMessage(`패키지 내보내기 실패: ${err.message}`);
                        reject(err);
                    });

                    archive.pipe(output);
                    
                    // 절대 경로가 포함되는 문제를 방지하기 위해 glob 패턴과 cwd 옵션 사용
                    archive.glob('**/*', { 
                        cwd: packagePath,
                        ignore: ['.git/**', 'node_modules/**']
                    }, { prefix: packageName });
                    
                    archive.finalize();
                });
            });
            
            vscode.window.showInformationMessage(`패키지 '${packageName}'가 '${outputPath}'에 내보내졌습니다.`);
        }],

        // Copy Template
        ['wizExplorer.copyTemplate', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('앱을 선택해주세요.');
                return;
            }

            const appPath = node.resourceUri.fsPath;
            const appJsonPath = path.join(appPath, 'app.json');

            if (!fs.existsSync(appJsonPath)) {
                vscode.window.showErrorMessage('app.json 파일을 찾을 수 없습니다.');
                return;
            }

            try {
                const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                const template = appJson.template || '';

                if (!template) {
                    vscode.window.showWarningMessage('template 값이 비어있습니다.');
                    return;
                }

                await vscode.env.clipboard.writeText(template);
                vscode.window.showInformationMessage(`Template 복사됨: ${template}`);
            } catch (e) {
                vscode.window.showErrorMessage(`Template 복사 실패: ${e.message}`);
            }
        }],

        // File operations
        ['wizExplorer.newFile', async (node) => {
            const targetDir = node?.resourceUri?.fsPath || fileExplorerProvider.workspaceRoot;
            if (!targetDir) return;

            const fileName = await vscode.window.showInputBox({ prompt: '새 파일 이름' });
            if (fileName) {
                WizFileUtils.safeWriteFile(path.join(targetDir, fileName), '');
                fileExplorerProvider.refresh();
            }
        }],

        ['wizExplorer.newFolder', async (node) => {
            const targetDir = node?.resourceUri?.fsPath || fileExplorerProvider.workspaceRoot;
            if (!targetDir) return;

            const folderName = await vscode.window.showInputBox({ prompt: '새 폴더 이름' });
            if (folderName) {
                fs.mkdirSync(path.join(targetDir, folderName), { recursive: true });
                fileExplorerProvider.refresh();
            }
        }],

        ['wizExplorer.delete', async (node) => {
            if (!node) return;
            
            const confirm = await vscode.window.showWarningMessage(
                `'${path.basename(node.resourceUri.fsPath)}'을(를) 삭제하시겠습니까?`,
                { modal: true },
                '삭제'
            );

            if (confirm === '삭제') {
                const deletedPath = node.resourceUri.fsPath;
                try {
                    fs.rmSync(deletedPath, { recursive: true, force: true });
                    
                    if (appEditorProvider.currentAppPath === deletedPath) {
                        appEditorProvider.currentWebviewPanel?.dispose();
                    }
                    
                    fileExplorerProvider.refresh();
                } catch (e) {
                    vscode.window.showErrorMessage(`삭제 실패: ${e.message}`);
                }
            }
        }],

        ['wizExplorer.copy', (node) => {
            if (node) {
                clipboard = node.resourceUri.fsPath;
                vscode.window.showInformationMessage(`복사됨: ${path.basename(clipboard)}`);
            }
        }],

        ['wizExplorer.downloadFile', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('다운로드할 파일을 선택해주세요.');
                return;
            }

            try {
                const fileUri = vscode.Uri.file(node.resourceUri.fsPath);
                
                // 기본 탐색기에서 파일을 reveal (선택)
                await vscode.commands.executeCommand('revealInExplorer', fileUri);
                
                // 안내 메시지
                vscode.window.showInformationMessage(
                    '파일이 탐색기에서 선택되었습니다. 우클릭하여 "다운로드..."를 선택하세요.'
                );
            } catch (err) {
                vscode.window.showErrorMessage(`파일 열기 실패: ${err.message}`);
            }
        }],

        ['wizExplorer.paste', async (node) => {
            if (!clipboard || !fs.existsSync(clipboard)) {
                vscode.window.showErrorMessage('복사된 항목이 없습니다.');
                return;
            }

            const targetDir = node?.resourceUri?.fsPath || fileExplorerProvider.workspaceRoot;
            if (!targetDir) return;

            const baseName = path.basename(clipboard);
            let targetPath = path.join(targetDir, baseName);

            let counter = 1;
            while (fs.existsSync(targetPath)) {
                const ext = path.extname(baseName);
                const name = path.basename(baseName, ext);
                targetPath = path.join(targetDir, `${name}_copy${counter}${ext}`);
                counter++;
            }

            try {
                if (fs.statSync(clipboard).isDirectory()) {
                    fs.cpSync(clipboard, targetPath, { recursive: true });
                } else {
                    fs.copyFileSync(clipboard, targetPath);
                }
                fileExplorerProvider.refresh();
            } catch (err) {
                vscode.window.showErrorMessage(`붙여넣기 실패: ${err.message}`);
            }
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
        ['wizExplorer.normalBuild', () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }
            triggerBuild(false);
        }],

        ['wizExplorer.cleanBuild', () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }
            triggerBuild(true);
        }],

        // Show build output
        ['wizExplorer.showBuildOutput', () => {
            buildOutputChannel.show(true);
        }],

        // Export current project directly
        ['wizExplorer.exportCurrentProject', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }

            const exportsPath = path.join(workspaceRoot, 'exports');
            if (!fs.existsSync(exportsPath)) {
                fs.mkdirSync(exportsPath, { recursive: true });
            }

            const outputPath = path.join(exportsPath, currentProject);

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `프로젝트 '${currentProject}' 내보내는 중...`,
                    cancellable: false
                }, async () => {
                    const command = `wiz project export --project=${currentProject} --output="${outputPath}"`;
                    buildOutputChannel.appendLine(`[Export] ${command}`);
                    buildOutputChannel.show(true);

                    await exec(command, { cwd: workspaceRoot });
                    buildOutputChannel.appendLine(`[Export] 완료: ${outputPath}`);
                });

                vscode.window.showInformationMessage(`프로젝트 '${currentProject}'가 exports 폴더로 내보내졌습니다.`);
                fileExplorerProvider.refresh();
            } catch (err) {
                buildOutputChannel.appendLine(`[Export] 실패: ${err.message}`);
                vscode.window.showErrorMessage(`프로젝트 내보내기 실패: ${err.message}`);
            }
        }],

        // Import project file (.wizproject)
        ['wizExplorer.importProject', async () => {
            if (!workspaceRoot) {
                vscode.window.showInformationMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            const projectBasePath = path.join(workspaceRoot, 'project');
            if (!fs.existsSync(projectBasePath)) {
                fs.mkdirSync(projectBasePath, { recursive: true });
            }

            const fileUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: { 'Wiz Project': ['wizproject'] },
                title: 'Wiz 프로젝트 파일 선택'
            });

            if (!fileUris || fileUris.length === 0) return;
            const filePath = fileUris[0].fsPath;

            const projectName = await vscode.window.showInputBox({
                title: '새 프로젝트 이름(Namespace) 입력',
                prompt: '영문 소문자와 숫자만 허용됩니다.',
                value: path.basename(filePath, '.wizproject'),
                validateInput: (value) => {
                    if (!/^[a-z0-9]+$/.test(value)) {
                        return '영문 소문자와 숫자만 허용됩니다.';
                    }
                    if (fs.existsSync(path.join(projectBasePath, value))) {
                        return '이미 존재하는 프로젝트 이름입니다.';
                    }
                    return null;
                }
            });

            if (!projectName) return;

            const targetPath = path.join(projectBasePath, projectName);

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `프로젝트 '${projectName}' 가져오는 중...`,
                    cancellable: false
                }, async () => {
                    fs.mkdirSync(targetPath, { recursive: true });
                    const command = `unzip -o "${filePath}" -d "${targetPath}"`;
                    buildOutputChannel.appendLine(`[Import] ${command}`);
                    buildOutputChannel.show(true);
                    await exec(command);
                    buildOutputChannel.appendLine(`[Import] 완료: ${targetPath}`);
                });

                const choice = await vscode.window.showInformationMessage(
                    `프로젝트 '${projectName}'를 성공적으로 가져왔습니다. 전환하시겠습니까?`,
                    '예', '아니오'
                );

                if (choice === '예') {
                    currentProject = projectName;
                    updateProjectRoot();
                }
            } catch (err) {
                if (fs.existsSync(targetPath)) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                }
                buildOutputChannel.appendLine(`[Import] 실패: ${err.message}`);
                vscode.window.showErrorMessage(`프로젝트 가져오기 실패: ${err.message}`);
            }
        }],

        // Go to App (search by name)
        ['wizExplorer.goToApp', async () => {
            if (!fileExplorerProvider.workspaceRoot) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }

            const srcPath = path.join(fileExplorerProvider.workspaceRoot, 'src');
            if (!fs.existsSync(srcPath)) return;

            const apps = [];
            
            // Helper to scan directory for apps
            function scanApps(dirPath, category) {
                if (!fs.existsSync(dirPath)) return;
                
                try {
                    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const appJsonPath = path.join(dirPath, entry.name, 'app.json');
                            if (fs.existsSync(appJsonPath)) {
                                try {
                                    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                                    apps.push({
                                        label: `$(${getAppIcon(appJson.mode || category)}) ${appJson.title || entry.name}`,
                                        description: appJson.id || entry.name,
                                        detail: category,
                                        appPath: path.join(dirPath, entry.name),
                                        mode: appJson.mode || category
                                    });
                                } catch (e) { /* skip invalid json */ }
                            }
                        }
                    }
                } catch (e) { /* skip inaccessible dirs */ }
            }

            function getAppIcon(mode) {
                const icons = {
                    'page': 'browser',
                    'component': 'symbol-class',
                    'widget': 'symbol-snippet',
                    'layout': 'layout',
                    'route': 'circuit-board',
                    'portal': 'package'
                };
                return icons[mode] || 'file-code';
            }

            // Scan standard app directories
            ['page', 'component', 'widget', 'layout'].forEach(type => {
                scanApps(path.join(srcPath, type), type);
            });

            // Scan route
            scanApps(path.join(srcPath, 'route'), 'route');

            // Scan portal packages
            const portalPath = path.join(srcPath, 'portal');
            if (fs.existsSync(portalPath)) {
                try {
                    const packages = fs.readdirSync(portalPath, { withFileTypes: true });
                    for (const pkg of packages) {
                        if (pkg.isDirectory()) {
                            scanApps(path.join(portalPath, pkg.name, 'app'), `portal/${pkg.name}`);
                            scanApps(path.join(portalPath, pkg.name, 'route'), `portal/${pkg.name}/route`);
                        }
                    }
                } catch (e) { /* skip */ }
            }

            if (apps.length === 0) {
                vscode.window.showInformationMessage('앱이 없습니다.');
                return;
            }

            const selected = await vscode.window.showQuickPick(apps, {
                placeHolder: '앱 이름으로 검색',
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selected) {
                appEditorProvider.openInfoEditor(selected.appPath, appContextListener);
            }
        }],

        // Open App Info for current file
        ['wizExplorer.openAppInfo', () => {
            const dirPath = resolveCurrentAppPath();
            if (!dirPath) {
                vscode.window.showWarningMessage('현재 열린 앱 파일이 없습니다.');
                return;
            }
            appEditorProvider.openInfoEditor(dirPath, appContextListener);
        }],

        // Copy template of current app
        ['wizExplorer.copyCurrentTemplate', async () => {
            const dirPath = resolveCurrentAppPath();
            if (!dirPath) {
                vscode.window.showWarningMessage('현재 열린 앱 파일이 없습니다.');
                return;
            }

            const appJsonPath = path.join(dirPath, 'app.json');
            if (!fs.existsSync(appJsonPath)) {
                vscode.window.showErrorMessage('app.json 파일을 찾을 수 없습니다.');
                return;
            }

            try {
                const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                const template = appJson.template || '';

                if (!template) {
                    vscode.window.showWarningMessage('template 값이 비어있습니다.');
                    return;
                }

                await vscode.env.clipboard.writeText(template);
                vscode.window.showInformationMessage(`Template 복사됨: ${template}`);
            } catch (e) {
                vscode.window.showErrorMessage(`Template 복사 실패: ${e.message}`);
            }
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
            const location = await selectAppLocation('page');
            if (!location) return;
            
            if (location.type === 'source') {
                await createStandardApp('page', location.path, fileExplorerProvider);
            } else {
                await createPortalApp(location.path, fileExplorerProvider);
            }
        }],

        ['wizExplorer.createComponent', async () => {
            const location = await selectAppLocation('component');
            if (!location) return;
            
            if (location.type === 'source') {
                await createStandardApp('component', location.path, fileExplorerProvider);
            } else {
                await createPortalApp(location.path, fileExplorerProvider);
            }
        }],

        ['wizExplorer.createLayout', async () => {
            const location = await selectAppLocation('layout');
            if (!location) return;
            
            if (location.type === 'source') {
                await createStandardApp('layout', location.path, fileExplorerProvider);
            } else {
                await createPortalApp(location.path, fileExplorerProvider);
            }
        }],

        ['wizExplorer.createRoute', async () => {
            const location = await selectRouteLocation();
            if (!location) return;
            
            await createRoute(location.path, location.type === 'package', fileExplorerProvider);
        }]
    ];

    // Helper: Get app parent path (src/app if exists, otherwise src)
    function getAppParentPath() {
        const srcPath = path.join(fileExplorerProvider.workspaceRoot, 'src');
        const appPath = path.join(srcPath, 'app');
        
        // src/app 폴더가 있으면 그 안에 생성, 없으면 src에 생성
        if (fs.existsSync(appPath) && fs.statSync(appPath).isDirectory()) {
            return appPath;
        }
        
        // src/app 폴더가 없으면 src 폴더에 생성
        if (!fs.existsSync(srcPath)) {
            fs.mkdirSync(srcPath, { recursive: true });
        }
        return srcPath;
    }

    // Helper: Get portal packages list
    function getPortalPackages() {
        const portalPath = path.join(fileExplorerProvider.workspaceRoot, 'src', 'portal');
        if (!fs.existsSync(portalPath)) return [];
        
        try {
            return fs.readdirSync(portalPath, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);
        } catch (e) {
            return [];
        }
    }

    // Helper: Select app location (Source or Package)
    async function selectAppLocation(appType) {
        const packages = getPortalPackages();
        
        const locationItems = [
            { label: '$(folder) Source', description: 'src 폴더에 생성', type: 'source' }
        ];
        
        if (packages.length > 0) {
            locationItems.push({ label: '$(package) Package', description: 'Portal 패키지에 생성', type: 'package' });
        }

        // 패키지가 없으면 바로 Source 선택
        if (packages.length === 0) {
            return { type: 'source', path: getAppParentPath() };
        }

        const locationChoice = await vscode.window.showQuickPick(locationItems, {
            title: `${appType.charAt(0).toUpperCase() + appType.slice(1)} 생성 위치 선택`,
            placeHolder: '앱을 생성할 위치를 선택하세요'
        });
        
        if (!locationChoice) return null;
        
        if (locationChoice.type === 'source') {
            return { type: 'source', path: getAppParentPath() };
        }
        
        // Package 선택
        const packageItems = packages.map(pkg => ({
            label: `$(package) ${pkg}`,
            value: pkg
        }));
        
        const selectedPackage = await vscode.window.showQuickPick(packageItems, {
            title: '패키지 선택',
            placeHolder: '앱을 생성할 패키지를 선택하세요'
        });
        
        if (!selectedPackage) return null;
        
        const packageAppPath = path.join(fileExplorerProvider.workspaceRoot, 'src', 'portal', selectedPackage.value, 'app');
        if (!fs.existsSync(packageAppPath)) {
            fs.mkdirSync(packageAppPath, { recursive: true });
        }
        
        return { type: 'package', path: packageAppPath };
    }

    // Helper: Select route location (Source or Package)
    async function selectRouteLocation() {
        const packages = getPortalPackages();
        
        const locationItems = [
            { label: '$(folder) Source', description: 'src/route 폴더에 생성', type: 'source' }
        ];
        
        if (packages.length > 0) {
            locationItems.push({ label: '$(package) Package', description: 'Portal 패키지에 생성', type: 'package' });
        }

        // 패키지가 없으면 바로 Source 선택
        if (packages.length === 0) {
            const routePath = path.join(fileExplorerProvider.workspaceRoot, 'src', 'route');
            if (!fs.existsSync(routePath)) {
                fs.mkdirSync(routePath, { recursive: true });
            }
            return { type: 'source', path: routePath };
        }

        const locationChoice = await vscode.window.showQuickPick(locationItems, {
            title: 'Route 생성 위치 선택',
            placeHolder: '라우트를 생성할 위치를 선택하세요'
        });
        
        if (!locationChoice) return null;
        
        if (locationChoice.type === 'source') {
            const routePath = path.join(fileExplorerProvider.workspaceRoot, 'src', 'route');
            if (!fs.existsSync(routePath)) {
                fs.mkdirSync(routePath, { recursive: true });
            }
            return { type: 'source', path: routePath };
        }
        
        // Package 선택
        const packageItems = packages.map(pkg => ({
            label: `$(package) ${pkg}`,
            value: pkg
        }));
        
        const selectedPackage = await vscode.window.showQuickPick(packageItems, {
            title: '패키지 선택',
            placeHolder: '라우트를 생성할 패키지를 선택하세요'
        });
        
        if (!selectedPackage) return null;
        
        const packageRoutePath = path.join(fileExplorerProvider.workspaceRoot, 'src', 'portal', selectedPackage.value, 'route');
        if (!fs.existsSync(packageRoutePath)) {
            fs.mkdirSync(packageRoutePath, { recursive: true });
        }
        
        return { type: 'package', path: packageRoutePath };
    }

    let clipboard = null;

    commands.forEach(([id, handler]) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(id, handler)
        );
    });
}

function deactivate() {}

module.exports = { activate, deactivate };
