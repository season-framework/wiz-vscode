const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const EditorBase = require('./editorBase');
const { WizFileUtils, WebviewTemplates } = require('../../core');

class PortalEditor extends EditorBase {
    constructor(context, portalJsonPath) {
        super(context);
        this.portalJsonPath = portalJsonPath;
    }

    async create() {
        const packagePath = path.dirname(this.portalJsonPath);
        const packageName = path.basename(packagePath);
        
        this.createNewPanel('wizPortalInfo', `${packageName} [INFO]`);
        this.initialize();
    }

    async revive(panel) {
        this.setPanel(panel);
        this.initialize();
    }

    createNewPanel(viewType, title) {
        super.createPanel(viewType, title);
    }

    initialize() {
        const portalData = WizFileUtils.safeReadJson(this.portalJsonPath) || {};
        this.panel.webview.html = this.generateHtml(portalData);
        this.panel.webview.onDidReceiveMessage(message => this.handleMessage(message));
    }

    generateHtml(data) {
        const bodyContent = `
            <div class="container">
                <h2>Package Info</h2>
                ${WebviewTemplates.formGroupInput('package', 'Package', data.package || '')}
                ${WebviewTemplates.formGroupInput('title', 'Title', data.title || '')}
                ${WebviewTemplates.formGroupInput('version', 'Version', data.version || '1.0.0')}
                
                <div class="btn-group">
                    <button class="btn-secondary" onclick="save()">Update</button>
                </div>
            </div>
        `;

        const scriptContent = `
            // Initialize state for restoration
            if (${JSON.stringify(this.portalJsonPath)}) {
                vscode.setState({ portalJsonPath: ${JSON.stringify(this.portalJsonPath)} });
            }

            // Custom form data collection for Portal fields
            function collectFormData() {
                return {
                    package: document.getElementById('package').value,
                    title: document.getElementById('title').value,
                    version: document.getElementById('version').value
                };
            }

            function save() {
                vscode.postMessage({ command: 'update', data: collectFormData() });
            }
        `;

        return WebviewTemplates.wrapHtml(bodyContent, scriptContent);
    }

    handleMessage(message) {
        if (message.command === 'update') {
            this.handleUpdate(message.data);
        }
    }

    handleUpdate(data) {
        // Validation: Package Name (Lowercase letters & numbers only, no spaces)
        if (data.package && !/^[a-z0-9]+$/.test(data.package)) {
            vscode.window.showErrorMessage('Invalid Package Name: Only lowercase letters and numbers are allowed (no spaces).');
            return;
        }

        try {
            const currentData = WizFileUtils.safeReadJson(this.portalJsonPath) || {};
            const currentPackagePath = path.dirname(this.portalJsonPath);
            const currentPackageName = path.basename(currentPackagePath);
            const newPackageName = data.package || currentPackageName;
            
            let targetJsonPath = this.portalJsonPath;
            let pathChanged = false;

            // Handle Folder Rename
            if (newPackageName !== currentPackageName) {
                const parentDir = path.dirname(currentPackagePath);
                const newPackagePath = path.join(parentDir, newPackageName);

                if (fs.existsSync(newPackagePath)) {
                    vscode.window.showErrorMessage(`Package already exists: ${newPackageName}`);
                    return;
                }

                try {
                    fs.renameSync(currentPackagePath, newPackagePath);
                    targetJsonPath = path.join(newPackagePath, 'portal.json');
                    pathChanged = true;
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to rename folder: ${err.message}`);
                    return;
                }
            }
            
            const newData = {
                package: newPackageName,
                title: data.title || '',
                version: data.version || currentData.version || '1.0.0',
                // Enforce Hidden Defaults
                use_app: true,
                use_widget: true,
                use_route: true,
                use_libs: true,
                use_styles: true,
                use_assets: true,
                use_controller: true,
                use_model: true
            };

            if (WizFileUtils.safeWriteJson(targetJsonPath, newData)) {
                vscode.window.showInformationMessage('Portal Info Updated');
                this.onFileSaved?.();
                if (pathChanged) {
                    vscode.commands.executeCommand('wizExplorer.refresh');
                    this.dispose();
                }
            } else {
                vscode.window.showErrorMessage('Failed to save portal.json');
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to update portal info: ${e.message}`);
        }
    }
}

module.exports = PortalEditor;
