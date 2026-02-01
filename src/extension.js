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
const { WizPathUtils, WizFileUtils, WizUriFactory, FILE_TYPE_MAPPING } = require('./core');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Wiz VSCode Explorer is now active');

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
            fileExplorerProvider.refresh();
            return;
        }

        const projectPath = path.join(workspaceRoot, 'project', currentProject);
        fileExplorerProvider.workspaceRoot = projectPath;
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

    // ==================== Commands Registration ====================
    const commands = [
        // Core commands
        ['wizExplorer.refresh', () => fileExplorerProvider.refresh()],
        ['wizExplorer.openAppEditor', (appPath, groupType) => appEditorProvider.openEditor(appPath, groupType)],
        ['wizExplorer.openPortalInfo', (portalJsonPath) => appEditorProvider.openPortalInfoEditor(portalJsonPath)],
        
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
                { label: '$(cloud-download) 프로젝트 불러오기...', description: 'Git 저장소 복제', action: 'import' },
                { label: '$(trash) 프로젝트 삭제하기...', description: '로컬 프로젝트 폴더 삭제', action: 'delete' },
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
        ['wizExplorer.newApp', (node) => {
            if (node?.contextValue === 'appGroup') {
                appEditorProvider.openCreateAppEditor(node.groupType, node.parentPath, fileExplorerProvider);
            } else if (node?.contextValue === 'portalAppGroup') {
                appEditorProvider.openCreatePortalAppEditor(node.resourceUri.fsPath, fileExplorerProvider);
            } else if (node?.contextValue === 'routeGroup') {
                appEditorProvider.openCreateRouteAppEditor(node.resourceUri.fsPath, false, fileExplorerProvider);
            } else if (node?.contextValue === 'portalRouteGroup') {
                appEditorProvider.openCreateRouteAppEditor(node.resourceUri.fsPath, true, fileExplorerProvider);
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
        ['wizExplorer.toggleAppFile', async () => {}]
    ];

    let clipboard = null;

    commands.forEach(([id, handler]) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(id, handler)
        );
    });
}

function deactivate() {}

module.exports = { activate, deactivate };
