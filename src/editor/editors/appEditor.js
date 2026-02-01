const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const EditorBase = require('./editorBase');
const { WizPathUtils, WizFileUtils, WebviewTemplates } = require('../../core');

class AppEditor extends EditorBase {
    constructor(context, appPath) {
        super(context);
        this.appPath = appPath;
    }

    async create(contextListener) {
        const { appTitle } = WizPathUtils.parseAppFolder(this.appPath);
        this.createNewPanel('wizAppInfo', `${appTitle} [INFO]`);
        await this.initialize(contextListener);
    }

    async revive(panel, contextListener) {
        this.setPanel(panel);
        await this.initialize(contextListener);
    }

    createNewPanel(viewType, title) {
        super.createPanel(viewType, title);
    }

    async initialize(contextListener) {
        // Setup State Listener
        this.panel.onDidChangeViewState(e => {
            if (e.webviewPanel.active) {
                contextListener.updateFromPath(this.appPath, 'info');
            }
        });

        // Load Data
        const appData = this.loadAppData();
        const formOptions = this.loadFormOptions();

        // Generate HTML
        this.panel.webview.html = this.generateHtml(appData, formOptions);

        // Notify Context
        contextListener.updateFromPath(this.appPath, 'info');

        // Setup Messages
        this.panel.webview.onDidReceiveMessage(message => this.handleMessage(message));
    }

    loadAppData() {
        const appJsonPath = path.join(this.appPath, 'app.json');
        return WizFileUtils.safeReadJson(appJsonPath);
    }

    loadFormOptions() {
        const { category } = WizPathUtils.parseAppFolder(this.appPath);
        const parentDir = path.dirname(this.appPath);
        const isPage = (category === 'page');
        
        const layouts = isPage ? WizPathUtils.loadLayouts(parentDir) : [];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.appPath));
        const controllerDir = WizPathUtils.findControllerDir(this.appPath, workspaceFolder);
        const controllers = WizPathUtils.loadControllers(controllerDir);

        return { layouts, isPage, controllers, category };
    }

    generateHtml(data, { layouts, isPage, controllers }) {
        const layoutField = isPage 
            ? WebviewTemplates.formGroupSelect('layout', 'Layout', layouts, data.layout || '')
            : `<input type="hidden" id="layout" value="${data.layout || ''}" />`;

        const ngRoutingField = isPage
            ? WebviewTemplates.formGroupInput('ngRouting', 'Angular Routing', data.viewuri || '')
            : `<input type="hidden" id="ngRouting" value="${data.viewuri || ''}" />`;

        const bodyContent = `
            <div class="container">
                <h2>App Info</h2>
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
            if (${JSON.stringify(this.appPath)}) {
                vscode.setState({ appPath: ${JSON.stringify(this.appPath)} });
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

    handleMessage(message) {
        if (message.command === 'update') {
            this.handleUpdate(message.data);
        } else if (message.command === 'delete') {
            this.handleDelete();
        }
    }

    handleUpdate(data) {
        let appJsonPath = path.join(this.appPath, 'app.json');
        
        try {
            const currentData = WizFileUtils.safeReadJson(appJsonPath);
            const newData = { ...currentData };
            
            // Handle Namespace change and folder rename
            const { category, appTitle } = WizPathUtils.parseAppFolder(this.appPath);
            let newAppPath = this.appPath;
            let pathChanged = false;

            if (data.namespace && data.namespace !== appTitle) {
                const parentDir = path.dirname(this.appPath);
                const newFolderName = `${category}.${data.namespace}`;
                const newId = `${category}.${data.namespace}`;
                newAppPath = path.join(parentDir, newFolderName);

                if (fs.existsSync(newAppPath)) {
                    vscode.window.showErrorMessage(`App already exists: ${newFolderName}`);
                    return;
                }

                try {
                    fs.renameSync(this.appPath, newAppPath);
                    appJsonPath = path.join(newAppPath, 'app.json');
                    newData.id = newId;
                    pathChanged = true;
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to rename folder: ${err.message}`);
                    return;
                }
            }
            
            // Map common fields
            if (data.title !== undefined) newData.title = data.title;
            if (data.namespace !== undefined) newData.namespace = data.namespace;
            if (data.category !== undefined) newData.category = data.category;
            if (data.ngRouting !== undefined) newData.viewuri = data.ngRouting;
            if (data.previewUrl !== undefined) newData.preview = data.previewUrl;
            if (data.controller !== undefined) newData.controller = data.controller;
            if (data.layout !== undefined) newData.layout = data.layout;

            if (WizFileUtils.safeWriteJson(appJsonPath, newData)) {
                vscode.window.showInformationMessage('App Info Updated');
                if (pathChanged) {
                    vscode.commands.executeCommand('wizExplorer.refresh');
                    this.dispose(); // Close webview on path change
                }
            } else {
                vscode.window.showErrorMessage('Failed to save app.json');
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save app.json: ${e.message}`);
        }
    }

    handleDelete() {
        vscode.window.showWarningMessage(
            `Are you sure you want to delete '${path.basename(this.appPath)}'?`,
            { modal: true },
            'Delete'
        ).then(selection => {
            if (selection === 'Delete') {
                try {
                    fs.rmSync(this.appPath, { recursive: true, force: true });
                    this.dispose();
                    vscode.window.showInformationMessage(`Deleted '${path.basename(this.appPath)}'`);
                    vscode.commands.executeCommand('wizExplorer.refresh');
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to delete app: ${e.message}`);
                }
            }
        });
    }
}

module.exports = AppEditor;
