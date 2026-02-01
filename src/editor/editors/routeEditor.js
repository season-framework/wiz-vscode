const vscode = require('vscode');
const path = require('path');
const AppEditor = require('./appEditor');
const { WizPathUtils, WizFileUtils, WebviewTemplates } = require('../../core');
const fs = require('fs');

class RouteEditor extends AppEditor {
    constructor(context, appPath) {
        super(context, appPath);
    }

    async create(contextListener) {
        const { appTitle } = WizPathUtils.parseAppFolder(this.appPath);
        this.createNewPanel('wizAppInfo', `${appTitle} [INFO]`); // Use same ID or specific one? logic uses wizAppInfo usually
        await this.initialize(contextListener);
    }

    loadFormOptions() {
        const { category } = WizPathUtils.parseAppFolder(this.appPath);
        
        const parentDir = path.dirname(this.appPath); // .../route
        const grandParentDir = path.dirname(parentDir); // .../src or .../portal/<pkg>
        const greatGrandParentDir = path.dirname(grandParentDir); // .../ or .../src/portal
        
        let controllerDir;
        
        // Check if we are in a portal package: .../src/portal/<pkg>/route/<app>
        if (path.basename(greatGrandParentDir) === 'portal') {
             // Portal Route: controller is in <pkg>/controller
             controllerDir = path.join(grandParentDir, 'controller');
        } else {
             // Standard Route: Use standard findControllerDir
             const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(this.appPath));
             controllerDir = WizPathUtils.findControllerDir(this.appPath, workspaceFolder);
        }

        const controllers = WizPathUtils.loadControllers(controllerDir);
        
        return { layouts: [], isPage: false, controllers, category };
    }

    // Reuse initialize from AppEditor but generateHtml is overridden

    generateHtml(data, { controllers }) {
        const bodyContent = `
            <div class="container">
                <h2>Route Info</h2>
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

    handleUpdate(data) {
        // Reuse handleUpdate from AppEditor? Route update is cleaner but AppEditor has specific logic
        // Route doesn't have namespace usually in the UI, but let's see. 
        // Route apps have folders like `route.test`. Namespace=test.
        // If AppEditor.handleUpdate logic works for Routes, we can reuse it, but we need to map fields specific to Route.
        
        // AppEditor logic maps: title, namespace, category, ngRouting(viewuri), preview(previewUrl), controller, layout.
        // Route needs: id, route, viewuri.
        
        let appJsonPath = path.join(this.appPath, 'app.json');
        try {
            const currentData = WizFileUtils.safeReadJson(appJsonPath);
            const newData = { ...currentData };
            
            // Route doesn't usually expose namespace renaming in the UI shown in `generateHtml` above.
            // But if we want to support renaming route ID/Folder, we need that logic.
            // The UI shows 'ID' field which corresponds to `app.json` id.
            
            // If ID changes, we shouldn't necessarily rename the folder unless implicit.
            // The user might just want to change the ID string.
            // However, Wiz usually binds ID to Folder name.
            
            if (data.title !== undefined) newData.title = data.title;
            if (data.id !== undefined) newData.id = data.id;
            if (data.route !== undefined) newData.route = data.route;
            if (data.viewuri !== undefined) newData.viewuri = data.viewuri; // Route uses viewuri
            if (data.category !== undefined) newData.category = data.category;
            if (data.controller !== undefined) newData.controller = data.controller;

            if (WizFileUtils.safeWriteJson(appJsonPath, newData)) {
                vscode.window.showInformationMessage('Route Info Updated');
            } else {
                vscode.window.showErrorMessage('Failed to save app.json');
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save: ${e.message}`);
        }
    }
}

module.exports = RouteEditor;
