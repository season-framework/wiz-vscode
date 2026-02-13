/**
 * App Context Listener (Refactored)
 * 활성 에디터 상태 추적 및 컨텍스트 관리
 */

const vscode = require('vscode');
const path = require('path');
const { WizPathUtils, WizFileUtils } = require('../core');

class AppContextListener {
    constructor(context) {
        this.context = context;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'wizExplorer.showAppMenu';
        context.subscriptions.push(this.statusBarItem);

        vscode.window.onDidChangeActiveTextEditor(() => this.updateContext());
        this.updateContext();
    }

    updateContext() {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor) {
            return;
        }

        let dirPath = this.resolveDirPath(editor);
        this.updateFromPath(dirPath);
    }

    /**
     * 에디터에서 디렉토리 경로 추출
     */
    resolveDirPath(editor) {
        if (!editor) return null;
        
        const uri = editor.document.uri;
        
        if (uri.scheme === 'wiz') {
            const realPath = WizPathUtils.getRealPathFromUri(uri);
            return realPath ? path.dirname(realPath) : null;
        } else if (uri.scheme === 'file') {
            return path.dirname(uri.fsPath);
        }
        
        return null;
    }

    updateFromPath(dirPath, forceType = null) {
        if (!dirPath) {
            this.setContext(false);
            this.statusBarItem.hide();
            vscode.commands.executeCommand('setContext', 'wizExplorer:activeFileType', '');
            return;
        }

        const isApp = WizPathUtils.isAppFolder(dirPath);
        this.setContext(isApp);
        
        if (isApp) {
            const { appTitle, category } = WizPathUtils.parseAppFolder(dirPath);
            this.statusBarItem.text = `$(package) Wiz App: ${appTitle}`;
            this.statusBarItem.show();

            const type = forceType || this.detectFileType();
            vscode.commands.executeCommand('setContext', 'wizExplorer:activeFileType', type);
            vscode.commands.executeCommand('setContext', 'wizExplorer:appCategory', category);
        } else {
            this.statusBarItem.hide();
            vscode.commands.executeCommand('setContext', 'wizExplorer:activeFileType', '');
            vscode.commands.executeCommand('setContext', 'wizExplorer:appCategory', '');
        }
    }

    /**
     * 현재 에디터에서 파일 타입 감지
     */
    detectFileType() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return '';

        const uri = editor.document.uri;
        
        if (uri.scheme === 'wiz') {
            const query = new URLSearchParams(uri.query || '');
            const label = query.get('label');
            if (label) {
                return WizFileUtils.getTypeFromVirtualPath(label) || '';
            }

            const realPath = WizPathUtils.getRealPathFromUri(uri);
            if (realPath) {
                const fileName = path.basename(realPath);
                return WizFileUtils.getTypeFromFileName(fileName) || '';
            }

            const virtualName = uri.path.split('/').pop();
            return WizFileUtils.getTypeFromVirtualPath(virtualName) || '';
        } else if (uri.scheme === 'file') {
            const fileName = path.basename(editor.document.fileName);
            return WizFileUtils.getTypeFromFileName(fileName) || '';
        }
        
        return '';
    }

    setContext(value) {
        vscode.commands.executeCommand('setContext', 'wizExplorer:isAppFile', value);
    }
}

module.exports = AppContextListener;
