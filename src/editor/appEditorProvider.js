/**
 * App Editor Provider (Refactored)
 * App 에디터 및 웹뷰 관리
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { 
    WizPathUtils, 
    WizFileUtils, 
    WizUriFactory, 
    WebviewTemplates,
    FILE_TYPE_MAPPING 
} = require('../core');

class AppEditorProvider {
    constructor(context) {
        this.context = context;
        this.currentWebviewPanel = undefined;
        this.currentAppPath = undefined;
    }

    /**
     * App 에디터 열기 (UI 파일 우선, Route는 Controller 우선)
     */
    async openEditor(appPath, groupType) {
        this.currentAppPath = appPath;
        this.closeWebview();

        const files = WizFileUtils.readAppFiles(appPath);
        let targetFile;

        if (groupType === 'route') {
            const controllerFile = files['controller'];
            targetFile = (controllerFile && controllerFile.exists) ? controllerFile : Object.values(files).find(f => f.exists);
        } else {
            const uiFile = files['ui'];
            targetFile = (uiFile && uiFile.exists) ? uiFile : Object.values(files).find(f => f.exists);
        }

        if (!targetFile) {
            vscode.window.showErrorMessage("이 App 폴더에는 편집할 수 있는 파일이 없습니다.");
            return;
        }

        const wizUri = WizUriFactory.fromAppPath(appPath, targetFile.fullPath, targetFile.label);
        const doc = await vscode.workspace.openTextDocument(wizUri);
        
        this.setDocumentLanguage(doc, targetFile.fullPath);
        await vscode.window.showTextDocument(doc, { preview: true });
    }

    /**
     * App Info 에디터 열기 (Webview)
     */
    async openInfoEditor(appPath, contextListener) {
        this.currentAppPath = appPath;

        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.reveal(vscode.ViewColumn.Active);
        } else {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

            const { appTitle, category } = WizPathUtils.parseAppFolder(appPath);
            
            this.currentWebviewPanel = vscode.window.createWebviewPanel(
                'wizAppInfo',
                `${appTitle} [INFO]`,
                vscode.ViewColumn.Active,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            this.currentWebviewPanel.onDidDispose(() => {
                this.currentWebviewPanel = undefined;
            });

            this.currentWebviewPanel.onDidChangeViewState(e => {
                if (e.webviewPanel.active) {
                    contextListener.updateFromPath(appPath, 'info');
                }
            });
        }

        const appData = this.loadAppData(appPath);
        const { layouts, isPage, controllers, category } = this.loadFormOptions(appPath);

        if (category === 'route') {
            this.currentWebviewPanel.webview.html = this.generateRouteInfoHtml(appData, controllers, appPath);
        } else {
            this.currentWebviewPanel.webview.html = this.generateInfoHtml(appData, layouts, isPage, controllers, appPath);
        }
        
        contextListener.updateFromPath(appPath, 'info');
        this.setupInfoMessageHandler(appPath, this.currentWebviewPanel);
    }

    /**
     * Restore Info Editor (Split/Reload)
     */
    reviveInfoEditor(panel, appPath, contextListener) {
        panel.onDidChangeViewState(e => {
            if (e.webviewPanel.active) {
                this.currentAppPath = appPath;
                contextListener.updateFromPath(appPath, 'info');
            }
        });
        
        // Load data and restore html
        try {
            const appData = this.loadAppData(appPath);
            const { layouts, isPage, controllers, category } = this.loadFormOptions(appPath);
            
            if (category === 'route') {
                panel.webview.html = this.generateRouteInfoHtml(appData, controllers, appPath);
            } else {
                panel.webview.html = this.generateInfoHtml(appData, layouts, isPage, controllers, appPath);
            }
            
            this.setupInfoMessageHandler(appPath, panel);
        } catch (e) {
            console.error('Failed to revive info editor:', e);
        }
    }

    /**
     * 새 App 생성 에디터 열기
     */
    async openCreateAppEditor(groupType, parentPath, fileExplorerProvider) {
        const isPage = (groupType === 'page');
        const layouts = isPage ? WizPathUtils.loadLayouts(parentPath) : [];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(parentPath));
        const controllerDir = WizPathUtils.findControllerDir(parentPath, workspaceFolder);
        const controllers = WizPathUtils.loadControllers(controllerDir);

        const panel = vscode.window.createWebviewPanel(
            'wizAppCreate',
            `New ${groupType}`,
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.webview.html = this.generateCreateHtml(groupType, layouts, isPage, controllers);
        this.setupCreateMessageHandler(panel, groupType, parentPath, fileExplorerProvider);
    }

    // ==================== Private Methods ====================

    closeWebview() {
        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.dispose();
            this.currentWebviewPanel = undefined;
        }
    }

    setDocumentLanguage(doc, filePath) {
        const language = WizFileUtils.getLanguageFromExtension(filePath);
        if (language) {
            vscode.languages.setTextDocumentLanguage(doc, language);
        }
    }

    loadAppData(appPath) {
        const appJsonPath = path.join(appPath, 'app.json');
        return WizFileUtils.safeReadJson(appJsonPath);
    }

    loadFormOptions(appPath) {
        const { category } = WizPathUtils.parseAppFolder(appPath);
        const parentDir = path.dirname(appPath);
        const isPage = (category === 'page');
        
        const layouts = isPage ? WizPathUtils.loadLayouts(parentDir) : [];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(appPath));
        const controllerDir = WizPathUtils.findControllerDir(appPath, workspaceFolder);
        const controllers = WizPathUtils.loadControllers(controllerDir);

        return { layouts, isPage, controllers, category };
    }

    setupInfoMessageHandler(appPath, panel = this.currentWebviewPanel) {
        const appJsonPath = path.join(appPath, 'app.json');
        
        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'update') {
                this.handleUpdate(appJsonPath, message.data);
            } else if (message.command === 'delete') {
                this.handleDelete(appPath);
            }
        });
    }

    setupCreateMessageHandler(panel, groupType, parentPath, fileExplorerProvider) {
        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'create') {
                await this.handleCreate(panel, groupType, parentPath, message.data, fileExplorerProvider);
            }
        });
    }

    handleUpdate(appJsonPath, data) {
        try {
            const currentData = WizFileUtils.safeReadJson(appJsonPath);
            const newData = { ...currentData };
            
            // Handle Namespace change and folder rename for app types (page, component, etc.)
            const appPath = path.dirname(appJsonPath);
            const { category, appTitle } = WizPathUtils.parseAppFolder(appPath);
            let newAppPath = appPath;

            if (category !== 'route' && data.namespace && data.namespace !== appTitle) {
                const parentDir = path.dirname(appPath);
                const newFolderName = `${category}.${data.namespace}`;
                const newId = `${category}.${data.namespace}`;
                newAppPath = path.join(parentDir, newFolderName);

                if (fs.existsSync(newAppPath)) {
                    vscode.window.showErrorMessage(`App already exists: ${newFolderName}`);
                    return;
                }

                try {
                    fs.renameSync(appPath, newAppPath);
                    // Update app.json path to new location
                    appJsonPath = path.join(newAppPath, 'app.json');
                    newData.id = newId;
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to rename folder: ${err.message}`);
                    return;
                }
            }
            
            if (data.title !== undefined) newData.title = data.title;
            if (data.namespace !== undefined) newData.namespace = data.namespace;
            if (data.category !== undefined) newData.category = data.category;
            if (data.ngRouting !== undefined) newData.viewuri = data.ngRouting;
            if (data.previewUrl !== undefined) newData.preview = data.previewUrl;
            
            // Route App specific fields
            if (data.id !== undefined) newData.id = data.id;
            if (data.route !== undefined) newData.route = data.route;
            if (data.viewuri !== undefined) newData.viewuri = data.viewuri;

            if (data.controller !== undefined) newData.controller = data.controller;
            if (data.layout !== undefined) newData.layout = data.layout;

            if (WizFileUtils.safeWriteJson(appJsonPath, newData)) {
                vscode.window.showInformationMessage('App Info Updated');
                if (newAppPath !== appPath) {
                    vscode.commands.executeCommand('wizExplorer.refresh');
                    // Close the webview as the path has changed
                    this.closeWebview();
                }
            } else {
                vscode.window.showErrorMessage('Failed to save app.json');
            }
        } catch (e) {
            vscode.window.showErrorMessage('Failed to save app.json');
        }
    }

    handleDelete(appPath) {
        vscode.window.showWarningMessage(
            `Are you sure you want to delete '${path.basename(appPath)}'?\nThis action cannot be undone.`,
            { modal: true },
            'Delete'
        ).then(selection => {
            if (selection === 'Delete') {
                try {
                    fs.rmSync(appPath, { recursive: true, force: true });
                    this.closeWebview();
                    vscode.window.showInformationMessage(`Deleted '${path.basename(appPath)}'`);
                    vscode.commands.executeCommand('wizExplorer.refresh');
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to delete app: ${e.message}`);
                }
            }
        });
    }

    async handleCreate(panel, groupType, parentPath, data, fileExplorerProvider) {
        if (!data.namespace) {
            vscode.window.showErrorMessage('Namespace is required');
            return;
        }

        const appID = `${groupType}.${data.namespace}`;
        const newAppPath = path.join(parentPath, appID);

        if (fs.existsSync(newAppPath)) {
            vscode.window.showErrorMessage(`App already exists: ${appID}`);
            return;
        }

        try {
            fs.mkdirSync(newAppPath, { recursive: true });

            const appJson = {
                id: appID,
                mode: groupType,
                title: data.title || data.namespace,
                namespace: data.namespace,
                category: data.category || data.namespace,
                viewuri: data.ngRouting || '',
                preview: data.previewUrl || '',
                controller: data.controller || '',
                layout: data.layout || ''
            };

            WizFileUtils.safeWriteJson(path.join(newAppPath, 'app.json'), appJson);
            vscode.window.showInformationMessage(`Created ${appID}`);
            panel.dispose();

            if (fileExplorerProvider) {
                fileExplorerProvider.refresh();
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to create app: ${e.message}`);
        }
    }

    // ==================== HTML Generation ====================

    generateRouteInfoHtml(data, controllers, appPath) {
        const bodyContent = `
            <div class="container">
                <h2>Route Info ${appPath ? '' : '(Preview)'}</h2>
                ${WebviewTemplates.formGroupInput('title', 'Title', data.title || '')}
                ${WebviewTemplates.formGroupInput('id', 'ID', data.id || '')}
                ${WebviewTemplates.formGroupInput('route', 'Route', data.route || '')}
                ${WebviewTemplates.formGroupInput('category', 'Category', data.category || '')}
                ${WebviewTemplates.formGroupInput('viewuri', 'Preview URL', data.viewuri || '')}
                ${WebviewTemplates.formGroupSelect('controller', 'Controller', controllers, data.controller || '')}
                
                <div class="btn-group">
                    <button class="btn-secondary" onclick="save()">Update</button>
                    <button class="btn-danger" onclick="del()">Delete</button>
                </div>
            </div>
        `;

        const scriptContent = `
            // Initialize state for restoration
            if (${JSON.stringify(appPath)}) {
                vscode.setState({ appPath: ${JSON.stringify(appPath)} });
            }

            function save() {
                vscode.postMessage({ command: 'update', data: collectFormData() });
            }
            function del() {
                vscode.postMessage({ command: 'delete' });
            }
        `;

        return WebviewTemplates.wrapHtml(bodyContent, scriptContent);
    }

    generateInfoHtml(data, layouts, isPage, controllers, appPath) {
        const layoutField = isPage 
            ? WebviewTemplates.formGroupSelect('layout', 'Layout', layouts, data.layout || '')
            : `<input type="hidden" id="layout" value="${data.layout || ''}" />`;

        const ngRoutingField = isPage
            ? WebviewTemplates.formGroupInput('ngRouting', 'Angular Routing', data.viewuri || '')
            : `<input type="hidden" id="ngRouting" value="${data.viewuri || ''}" />`;

        const bodyContent = `
            <div class="container">
                <h2>App Info ${appPath ? '' : '(Preview)'}</h2>
                ${WebviewTemplates.formGroupInput('title', 'Title', data.title || '')}
                ${WebviewTemplates.formGroupInput('namespace', 'Namespace', data.namespace || '')}
                ${WebviewTemplates.formGroupInput('category', 'Category', data.category || '')}
                ${ngRoutingField}
                ${WebviewTemplates.formGroupInput('previewUrl', 'Preview URL', data.preview || '')}
                ${WebviewTemplates.formGroupSelect('controller', 'Controller', controllers, data.controller || '')}
                ${layoutField}
                <div class="btn-group">
                    <button class="btn-secondary" onclick="save()">Update</button>
                    <button class="btn-danger" onclick="del()">Delete</button>
                </div>
            </div>
        `;

        const scriptContent = `
            // Initialize state for restoration
            if (${JSON.stringify(appPath)}) {
                vscode.setState({ appPath: ${JSON.stringify(appPath)} });
            }

            function save() {
                vscode.postMessage({ command: 'update', data: collectFormData() });
            }
            function del() {
                vscode.postMessage({ command: 'delete' });
            }
        `;

        return WebviewTemplates.wrapHtml(bodyContent, scriptContent);
    }

    generateCreateHtml(groupType, layouts, isPage, controllers) {
        const layoutField = isPage 
            ? WebviewTemplates.formGroupSelect('layout', 'Layout', layouts, '')
            : `<input type="hidden" id="layout" value="" />`;

        const ngRoutingField = isPage
            ? WebviewTemplates.formGroupInput('ngRouting', 'Angular Routing', '')
            : `<input type="hidden" id="ngRouting" value="" />`;

        const capitalizedType = groupType.charAt(0).toUpperCase() + groupType.slice(1);

        const bodyContent = `
            <div class="container">
                <h2>New ${capitalizedType}</h2>
                ${WebviewTemplates.formGroupInput('namespace', 'Namespace', '', 'Required', { autofocus: true })}
                ${WebviewTemplates.formGroupInput('title', 'Title', '', 'Optional')}
                ${WebviewTemplates.formGroupInput('category', 'Category', '', 'Optional')}
                ${ngRoutingField}
                ${WebviewTemplates.formGroupInput('previewUrl', 'Preview URL', '', 'Optional')}
                ${WebviewTemplates.formGroupSelect('controller', 'Controller', controllers, '')}
                ${layoutField}
                <div class="btn-group">
                    <button class="btn-primary" onclick="save()">Create App</button>
                </div>
            </div>
        `;

        const scriptContent = `
            function save() {
                vscode.postMessage({ command: 'create', data: collectFormData() });
            }
        `;

        return WebviewTemplates.wrapHtml(bodyContent, scriptContent);
    }

    /**
     * App 파일 정보 읽기 (외부 호출용)
     */
    readAppFiles(appPath) {
        return WizFileUtils.readAppFiles(appPath);
    }
}

module.exports = AppEditorProvider;
