/**
 * App Editor Provider (Refactored)
 * App 에디터 및 웹뷰 관리
 */

const vscode = require('vscode');
const path = require('path');
const { 
    WizPathUtils, 
    WizFileUtils, 
    WizUriFactory 
} = require('../core');

const AppEditor = require('./editors/appEditor');
const RouteEditor = require('./editors/routeEditor');
const PortalEditor = require('./editors/portalEditor');
const PortalAppEditor = require('./editors/portalAppEditor');

class AppEditorProvider {
    constructor(context) {
        this.context = context;
        this.activeEditor = undefined; // Holds the current active webview editor instance
        this.currentAppPath = undefined;
        this.onFileSaved = null; // Build trigger callback
    }

    /**
     * App 에디터 열기 (UI 파일 우선, Route는 Controller 우선)
     */
    async openEditor(appPath, groupType) {
        // 기존 Webview가 있으면 닫기 (새로운 파일 열기 시 집중)
        if (this.activeEditor) {
            this.activeEditor.dispose();
            this.activeEditor = undefined;
        }

        this.currentAppPath = appPath;

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

        // 이미 열려있는 Webview가 같은 경로라면 포커스, 아니면 닫고 새로 생성
        if (this.activeEditor && this.activeEditor.appPath === appPath) {
            if (this.activeEditor.isVisible) {
                this.activeEditor.panel.reveal(vscode.ViewColumn.Active);
                return;
            }
        }
        
        if (this.activeEditor) {
            this.activeEditor.dispose();
        }

        const { category } = WizPathUtils.parseAppFolder(appPath);

        if (category === 'route') {
            this.activeEditor = new RouteEditor(this.context, appPath);
        } else if (category === 'portal-app') {
            this.activeEditor = new PortalAppEditor(this.context, appPath);
        } else {
            this.activeEditor = new AppEditor(this.context, appPath);
        }

        this.activeEditor.onFileSaved = this.onFileSaved;
        await this.activeEditor.create(contextListener);
        
        // 에디터가 닫힐 때 참조 해제
        this.activeEditor.panel.onDidDispose(() => {
            if (this.activeEditor && !this.activeEditor.panel) {
                this.activeEditor = undefined;
            }
        });
    }

    /**
     * Portal Info 에디터 열기 (Webview)
     */
    async openPortalInfoEditor(portalJsonPath) {
        if (this.activeEditor) {
            this.activeEditor.dispose();
        }

        this.activeEditor = new PortalEditor(this.context, portalJsonPath);
        this.activeEditor.onFileSaved = this.onFileSaved;
        await this.activeEditor.create();
        
        this.activeEditor.panel.onDidDispose(() => {
            this.activeEditor = undefined;
        });
    }

    /**
     * Restore Info Editor (Split/Reload)
     */
    reviveInfoEditor(panel, state, contextListener) {
        if (state.portalJsonPath) {
            this.activeEditor = new PortalEditor(this.context, state.portalJsonPath);
            this.activeEditor.revive(panel);
        } else if (state.appPath) {
            const { category } = WizPathUtils.parseAppFolder(state.appPath);
            if (category === 'route') {
                this.activeEditor = new RouteEditor(this.context, state.appPath);
            } else if (category === 'portal-app') {
                this.activeEditor = new PortalAppEditor(this.context, state.appPath);
            } else {
                this.activeEditor = new AppEditor(this.context, state.appPath);
            }
            this.activeEditor.revive(panel, contextListener);
        }

        if (this.activeEditor) {
            this.activeEditor.panel.onDidDispose(() => {
                this.activeEditor = undefined;
            });
        }
    }

    setDocumentLanguage(doc, filePath) {
        const language = WizFileUtils.getLanguageFromExtension(filePath);
        if (language) {
            vscode.languages.setTextDocumentLanguage(doc, language);
        }
    }

    /**
     * App 파일 정보 읽기 (외부 호출용)
     */
    readAppFiles(appPath) {
        return WizFileUtils.readAppFiles(appPath);
    }
}

module.exports = AppEditorProvider;
