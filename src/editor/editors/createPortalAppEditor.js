const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const EditorBase = require('./editorBase');
const { WizFileUtils, WebviewTemplates, WizPathUtils } = require('../../core'); // WizPathUtils needed

class CreatePortalAppEditor extends EditorBase {
    constructor(context, parentPath) {
        super(context);
        this.parentPath = parentPath;
    }

    async create(fileExplorerProvider) {
        this.createPanel('wizPortalAppCreate', `New Portal App`);
        await this.initialize(fileExplorerProvider);
    }

    async initialize(fileExplorerProvider) {
        // Load controllers from ../controller relative to parentPath (which is .../app)
        const packagePath = path.dirname(this.parentPath);
        const controllerDir = path.join(packagePath, 'controller');
        const controllers = WizPathUtils.loadControllers(controllerDir);

        this.panel.webview.html = this.generateHtml(controllers);

        this.panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'create') {
                this.handleCreate(message.data, fileExplorerProvider);
            }
        });
    }

    generateHtml(controllers) {
        const bodyContent = `
            <div class="container">
                <h2>New Portal App</h2>
                ${WebviewTemplates.formGroupInput('namespace', 'Namespace', '', 'Required', { autofocus: true })}
                ${WebviewTemplates.formGroupInput('title', 'Title', '', 'Optional')}
                ${WebviewTemplates.formGroupInput('category', 'Category', 'editor', 'Optional')}
                ${WebviewTemplates.formGroupInput('viewuri', 'View URI', '', 'Optional')}
                ${WebviewTemplates.formGroupSelect('controller', 'Controller', controllers, '')}
                
                <div class="btn-group">
                    <button class="btn-primary" onclick="save()">Create Portal App</button>
                </div>
            </div>
        `;

        const scriptContent = `
            function collectFormData() {
                return {
                    namespace: document.getElementById('namespace').value,
                    title: document.getElementById('title').value,
                    category: document.getElementById('category').value,
                    viewuri: document.getElementById('viewuri').value,
                    controller: document.getElementById('controller').value
                };
            }

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

        // Folder name is just namespace
        const appID = data.namespace;
        const newAppPath = path.join(this.parentPath, appID);

        if (fs.existsSync(newAppPath)) {
            vscode.window.showErrorMessage(`App already exists: ${appID}`);
            return;
        }

        try {
            fs.mkdirSync(newAppPath, { recursive: true });

            const appJson = {
                id: appID,
                mode: 'portal',
                title: data.title || data.namespace,
                namespace: data.namespace,
                category: data.category || 'editor',
                viewuri: data.viewuri || '',
                controller: data.controller || '',
                template: '' // Initialize empty or maybe construct it? 
                             // "wiz-portal-<pkg>-<namespace>(...)" 
                             // Let's leave it empty as per previous instruction to hide/auto-manage template in edit
            };

            // Auto-generate template string if needed? 
            // The user provided template example: "wiz-portal-dizest-editor-default([dizest]=\"\", [editor]=\"\")"
            // Let's construct a basic one based on package and namespace
            const packagePath = path.dirname(this.parentPath);
            const packageName = path.basename(packagePath);
            appJson.template = `wiz-portal-${packageName}-${data.namespace.replace(/\./g, '-')}`;

            WizFileUtils.safeWriteJson(path.join(newAppPath, 'app.json'), appJson);
            
            // Create empty view files? Not explicitly requested but good practice
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.pug'), '');
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.scss'), '');
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'view.ts'), '');

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

module.exports = CreatePortalAppEditor;
