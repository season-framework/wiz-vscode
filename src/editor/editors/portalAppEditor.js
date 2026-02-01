const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const AppEditor = require('./appEditor');
const { WizFileUtils, WebviewTemplates, WizPathUtils } = require('../../core');

class PortalAppEditor extends AppEditor {
    constructor(context, appPath) {
        super(context, appPath);
    }

    async create(contextListener) {
        // Just title (folder name)
        const appTitle = path.basename(this.appPath);
        this.createNewPanel('wizAppInfo', `${appTitle} [INFO]`);
        
        // 중요: Webview의 상태가 변경될 때 Context Listener에 알림을 보내야 
        // 탭 전환 등(switchFile)이 올바른 context(appPath)를 기반으로 동작함
        this.panel.onDidChangeViewState(e => {
            if (this.panel.active) {
                // Portal App은 일반 App과 유사하게 취급하여 단축키 동작하도록 함
                // 단, Portal App은 mode=portal 등을 가짐
                contextListener.updateFromPath(this.appPath, 'info');
            }
        });

        await this.initialize(contextListener);
    }

    // Override loadFormOptions to use portal specific controller path
    loadFormOptions() {
        // src/portal/<package>/app/<app>
        const appParent = path.dirname(this.appPath); // app
        const packagePath = path.dirname(appParent);  // <package>
        const controllerDir = path.join(packagePath, 'controller');
        
        const controllers = WizPathUtils.loadControllers(controllerDir);

        // Portal Apps don't utilize layouts
        return { layouts: [], isPage: false, controllers, category: 'portal-app' };
    }

    // Override generateHtml to show Portal App specific fields
    generateHtml(data, { controllers }) {
        const bodyContent = `
            <div class="container">
                <h2>Portal App Info</h2>
                ${WebviewTemplates.formGroupInput('title', 'Title', data.title || '')}
                ${WebviewTemplates.formGroupInput('namespace', 'Namespace', data.namespace || '')}
                ${WebviewTemplates.formGroupInput('category', 'Category', data.category || 'editor')}
                ${WebviewTemplates.formGroupInput('viewuri', 'View URI', data.viewuri || '')}
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

            function collectFormData() {
                return {
                    title: document.getElementById('title').value,
                    namespace: document.getElementById('namespace').value,
                    category: document.getElementById('category').value,
                    viewuri: document.getElementById('viewuri').value,
                    controller: document.getElementById('controller').value
                };
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
        let appJsonPath = path.join(this.appPath, 'app.json');
        
        try {
            const currentData = WizFileUtils.safeReadJson(appJsonPath) || {};
            
            // Portal apps mode is 'portal'
            if (currentData.mode !== 'portal') {
                // If it isn't portal, should we force it? User says "mode가 portal로 되어야하고"
                // Assuming we preserve it or set it if new/missing.
            }

            const newData = { ...currentData };
            
            // Handle Renaming (Strictly Namespace matching)
            // Portal apps: id == namespace == foldername (usually)
            // If namespace changes, we rename folder to new namespace.
            // AND we update 'id' to new namespace (or data.id if user provided it, but usually they sync).
            // User provided payload example: id matches namespace.
            
            const currentNamespace = currentData.namespace || path.basename(this.appPath);
            const newNamespace = data.namespace;
            let newAppPath = this.appPath;
            let pathChanged = false;

            if (newNamespace && newNamespace !== currentNamespace) {
                const parentDir = path.dirname(this.appPath);
                // Portal app folder name is just namespace (no prefix)
                const newFolderName = newNamespace;
                newAppPath = path.join(parentDir, newFolderName);

                if (fs.existsSync(newAppPath)) {
                    vscode.window.showErrorMessage(`App already exists: ${newFolderName}`);
                    return;
                }

                try {
                    fs.renameSync(this.appPath, newAppPath);
                    appJsonPath = path.join(newAppPath, 'app.json');
                    newData.id = newNamespace; // Auto-update ID to match namespace
                    newData.namespace = newNamespace;
                    pathChanged = true;
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to rename folder: ${err.message}`);
                    return;
                }
            } else {
                // If namespace didn't change (or folder rename failed/skipped), 
                // ensure ID matches namespace (sync even if no move happened, unless intended otherwise)
                // Assuming portal app ID always equals namespace.
                if (newNamespace) {
                    newData.id = newNamespace;
                    newData.namespace = newNamespace;
                }
            }
            
            // Update fields
            if (data.title !== undefined) newData.title = data.title;
            // id is auto-managed by namespace above

            if (data.category !== undefined) newData.category = data.category;
            if (data.viewuri !== undefined) newData.viewuri = data.viewuri;
            if (data.controller !== undefined) newData.controller = data.controller;
            // template handled automatically based on package/namespace, or preserved if valid. 
            // We removed template from UI, so we don't update it from data.template (undefined)
            // But we should probably generate it if creating new, or leave it alone if existing.
            
            // If we need to dynamically update template based on namespace change:
            if (currentData.template && pathChanged) {
                 // Try to replace namespace part in template string if it follows standard format
                 // But complex string replacement might be risky without strict pattern. 
                 // For now, let's keep it as is, or update if it matches "wiz-portal-<package>-<old_namespace>(...)"
                 // Getting package name:
                 const appParent = path.dirname(this.appPath); 
                 const packagePath = path.dirname(appParent);
                 const packageName = path.basename(packagePath);
                 
                 const oldTemplatePrefix = `wiz-portal-${packageName}-${currentNamespace}`;
                 const newTemplatePrefix = `wiz-portal-${packageName}-${newNamespace}`;
                 
                 if (newData.template.startsWith(oldTemplatePrefix)) {
                     newData.template = newData.template.replace(oldTemplatePrefix, newTemplatePrefix);
                 }
            }

            // Ensure mode is portal
            newData.mode = 'portal';

            if (WizFileUtils.safeWriteJson(appJsonPath, newData)) {
                vscode.window.showInformationMessage('Portal App Info Updated');
                if (pathChanged) {
                    vscode.commands.executeCommand('wizExplorer.refresh');
                    this.dispose();
                }
            } else {
                vscode.window.showErrorMessage('Failed to save app.json');
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to save: ${e.message}`);
        }
    }
}

module.exports = PortalAppEditor;
