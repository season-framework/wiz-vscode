const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const EditorBase = require('./editorBase');
const { WizPathUtils, WizFileUtils, WebviewTemplates } = require('../../core');

class CreateAppEditor extends EditorBase {
    constructor(context, groupType, parentPath) {
        super(context);
        this.groupType = groupType;
        this.parentPath = parentPath;
    }

    async create(fileExplorerProvider) {
        const capitalizedType = this.groupType.charAt(0).toUpperCase() + this.groupType.slice(1);
        this.createPanel('wizAppCreate', `New ${capitalizedType}`);
        
        await this.initialize(fileExplorerProvider);
    }

    async initialize(fileExplorerProvider) {
        const isPage = (this.groupType === 'page');
        const layouts = isPage ? WizPathUtils.loadLayouts(this.parentPath) : [];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.parentPath));
        const controllerDir = WizPathUtils.findControllerDir(this.parentPath, workspaceFolder);
        const controllers = WizPathUtils.loadControllers(controllerDir);

        this.panel.webview.html = this.generateHtml(layouts, isPage, controllers);

        this.panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'create') {
                this.handleCreate(message.data, fileExplorerProvider);
            }
        });
    }

    generateHtml(layouts, isPage, controllers) {
        const layoutField = isPage 
            ? WebviewTemplates.formGroupSelect('layout', 'Layout', layouts, '')
            : `<input type="hidden" id="layout" value="" />`;

        const ngRoutingField = isPage
            ? WebviewTemplates.formGroupInput('ngRouting', 'Angular Routing', '')
            : `<input type="hidden" id="ngRouting" value="" />`;

        const capitalizedType = this.groupType.charAt(0).toUpperCase() + this.groupType.slice(1);

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

    async handleCreate(data, fileExplorerProvider) {
        if (!data.namespace) {
            vscode.window.showErrorMessage('Namespace is required');
            return;
        }

        const appID = `${this.groupType}.${data.namespace}`;
        const newAppPath = path.join(this.parentPath, appID);

        if (fs.existsSync(newAppPath)) {
            vscode.window.showErrorMessage(`App already exists: ${appID}`);
            return;
        }

        try {
            fs.mkdirSync(newAppPath, { recursive: true });

            const appJson = {
                id: appID,
                mode: this.groupType,
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
            this.dispose();

            if (fileExplorerProvider) {
                fileExplorerProvider.refresh();
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to create app: ${e.message}`);
        }
    }
}

module.exports = CreateAppEditor;
