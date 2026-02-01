const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const EditorBase = require('./editorBase');
const { WizFileUtils, WebviewTemplates, WizPathUtils } = require('../../core');

class CreateRouteAppEditor extends EditorBase {
    constructor(context, parentPath, isPortalRoute) {
        super(context);
        this.parentPath = parentPath;
        this.isPortalRoute = isPortalRoute;
    }

    async create(fileExplorerProvider) {
        const title = this.isPortalRoute ? 'New Portal Route' : 'New Route';
        this.createPanel('wizRouteAppCreate', title);
        await this.initialize(fileExplorerProvider);
    }

    async initialize(fileExplorerProvider) {
        let controllerDir;
        
        if (this.isPortalRoute) {
            // Portal Route: parentPath is .../src/portal/<pkg>/route
            const packagePath = path.dirname(this.parentPath);
            controllerDir = path.join(packagePath, 'controller');
        } else {
            // Standard Route: parentPath is .../src/route
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.parentPath));
            controllerDir = WizPathUtils.findControllerDir(this.parentPath, workspaceFolder);
        }
        
        const controllers = WizPathUtils.loadControllers(controllerDir);

        this.panel.webview.html = this.generateHtml(controllers);

        this.panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'create') {
                this.handleCreate(message.data, fileExplorerProvider);
            }
        });
    }

    generateHtml(controllers) {
        const title = this.isPortalRoute ? 'New Portal Route' : 'New Route';
        
        const bodyContent = `
            <div class="container">
                <h2>${title}</h2>
                ${WebviewTemplates.formGroupInput('id', 'ID (Folder Name)', '', 'Required (lowercase + numbers only)', { autofocus: true })}
                ${WebviewTemplates.formGroupInput('title', 'Title', '', 'Optional')}
                ${WebviewTemplates.formGroupInput('route', 'Route Path', '', 'e.g. /api/example')}
                ${WebviewTemplates.formGroupInput('category', 'Category', '', 'Optional')}
                ${WebviewTemplates.formGroupInput('viewuri', 'Preview URL', '', 'Optional')}
                ${WebviewTemplates.formGroupSelect('controller', 'Controller', controllers, '')}
                
                <div class="btn-group">
                    <button class="btn-primary" onclick="save()">Create Route</button>
                </div>
            </div>
        `;

        const scriptContent = `
            // ID validation: lowercase + numbers only
            document.getElementById('id').addEventListener('input', function(e) {
                const value = e.target.value;
                const valid = /^[a-z0-9]*$/.test(value);
                e.target.style.borderColor = valid ? '' : 'var(--vscode-inputValidation-errorBorder, red)';
            });

            function collectFormData() {
                return {
                    id: document.getElementById('id').value,
                    title: document.getElementById('title').value,
                    route: document.getElementById('route').value,
                    category: document.getElementById('category').value,
                    viewuri: document.getElementById('viewuri').value,
                    controller: document.getElementById('controller').value
                };
            }

            function save() {
                const data = collectFormData();
                if (!/^[a-z0-9]+$/.test(data.id)) {
                    alert('ID must contain only lowercase letters and numbers');
                    return;
                }
                vscode.postMessage({ command: 'create', data: data });
            }
        `;

        return WebviewTemplates.wrapHtml(bodyContent, scriptContent);
    }

    async handleCreate(data, fileExplorerProvider) {
        if (!data.id) {
            vscode.window.showErrorMessage('ID is required');
            return;
        }

        // Validate ID: lowercase + numbers only
        if (!/^[a-z0-9]+$/.test(data.id)) {
            vscode.window.showErrorMessage('ID must contain only lowercase letters and numbers');
            return;
        }

        const newAppPath = path.join(this.parentPath, data.id);

        if (fs.existsSync(newAppPath)) {
            vscode.window.showErrorMessage(`Route already exists: ${data.id}`);
            return;
        }

        try {
            fs.mkdirSync(newAppPath, { recursive: true });

            const appJson = {
                id: data.id,
                title: data.title || data.id,
                route: data.route || '',
                category: data.category || '',
                viewuri: data.viewuri || '',
                controller: data.controller || ''
            };

            WizFileUtils.safeWriteJson(path.join(newAppPath, 'app.json'), appJson);
            
            // Create controller.py as default file for route
            WizFileUtils.safeWriteFile(path.join(newAppPath, 'controller.py'), '');

            vscode.window.showInformationMessage(`Created route: ${data.id}`);
            this.dispose();

            if (fileExplorerProvider) {
                fileExplorerProvider.refresh();
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to create route: ${e.message}`);
        }
    }
}

module.exports = CreateRouteAppEditor;
