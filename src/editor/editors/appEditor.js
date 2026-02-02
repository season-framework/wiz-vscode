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

        // Detect current view type (pug or html)
        const hasPug = fs.existsSync(path.join(this.appPath, 'view.pug'));
        const hasHtml = fs.existsSync(path.join(this.appPath, 'view.html'));
        const currentViewType = hasPug ? 'pug' : (hasHtml ? 'html' : 'pug');

        return { layouts, isPage, controllers, category, currentViewType };
    }

    generateHtml(data, { layouts, isPage, controllers, currentViewType }) {
        const layoutField = isPage 
            ? WebviewTemplates.formGroupSelect('layout', 'Layout', layouts, data.layout || '')
            : `<input type="hidden" id="layout" value="${data.layout || ''}" />`;

        const ngRoutingField = isPage
            ? WebviewTemplates.formGroupInput('ngRouting', 'Angular Routing', data.viewuri || '')
            : `<input type="hidden" id="ngRouting" value="${data.viewuri || ''}" />`;

        // View Type 선택 (pug/html)
        const viewTypeField = `
            <div class="form-group">
                <label>View Type</label>
                <select id="viewType">
                    <option value="pug" ${currentViewType === 'pug' ? 'selected' : ''}>Pug</option>
                    <option value="html" ${currentViewType === 'html' ? 'selected' : ''}>HTML</option>
                </select>
            </div>
        `;

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
                ${viewTypeField}
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

            // Handle View Type change (pug <-> html)
            if (data.viewType) {
                const targetAppPath = pathChanged ? newAppPath : this.appPath;
                this.handleViewTypeChange(targetAppPath, data.viewType);
            }

            if (WizFileUtils.safeWriteJson(appJsonPath, newData)) {
                vscode.window.showInformationMessage('App Info Updated');
                console.log('[Wiz] App Info saved, triggering build. onFileSaved:', typeof this.onFileSaved);
                if (typeof this.onFileSaved === 'function') {
                    this.onFileSaved();
                }
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

    /**
     * View Type 변경 처리 (pug <-> html)
     * @param {string} appPath - 앱 경로
     * @param {string} targetType - 변경할 타입 ('pug' | 'html')
     */
    handleViewTypeChange(appPath, targetType) {
        const pugPath = path.join(appPath, 'view.pug');
        const htmlPath = path.join(appPath, 'view.html');
        
        const hasPug = fs.existsSync(pugPath);
        const hasHtml = fs.existsSync(htmlPath);
        
        // 현재 타입 확인
        const currentType = hasPug ? 'pug' : (hasHtml ? 'html' : null);
        
        // 같은 타입이면 무시
        if (currentType === targetType) return;
        
        try {
            if (targetType === 'html' && hasPug) {
                // pug -> html 변환
                const pugContent = fs.readFileSync(pugPath, 'utf8');
                // 간단한 변환: pug 내용을 HTML 주석으로 감싸서 보존
                const htmlContent = `<!-- Converted from Pug -->\n<!-- Original Pug:\n${pugContent}\n-->\n<div>Hello, World!</div>`;
                fs.writeFileSync(htmlPath, htmlContent, 'utf8');
                fs.unlinkSync(pugPath);
                vscode.window.showInformationMessage('View 타입이 HTML로 변경되었습니다.');
            } else if (targetType === 'pug' && hasHtml) {
                // html -> pug 변환
                const htmlContent = fs.readFileSync(htmlPath, 'utf8');
                // 간단한 변환: html 내용을 주석으로 감싸서 보존
                const pugContent = `//- Converted from HTML\n//- Original HTML:\n//- ${htmlContent.replace(/\n/g, '\n//- ')}\ndiv Hello, World!`;
                fs.writeFileSync(pugPath, pugContent, 'utf8');
                fs.unlinkSync(htmlPath);
                vscode.window.showInformationMessage('View 타입이 Pug로 변경되었습니다.');
            } else if (!currentType) {
                // 파일이 없는 경우 새로 생성
                if (targetType === 'pug') {
                    fs.writeFileSync(pugPath, 'div Hello, World!', 'utf8');
                } else {
                    fs.writeFileSync(htmlPath, '<div>Hello, World!</div>', 'utf8');
                }
            }
        } catch (e) {
            vscode.window.showErrorMessage(`View 타입 변경 실패: ${e.message}`);
        }
    }
}

module.exports = AppEditor;
