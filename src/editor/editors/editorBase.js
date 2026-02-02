const vscode = require('vscode');

class EditorBase {
    constructor(context) {
        this.context = context;
        this.panel = undefined;
        this.onFileSaved = null; // Build trigger callback
    }

    createPanel(viewType, title, viewColumn = vscode.ViewColumn.Active) {
        this.dispose();

        this.panel = vscode.window.createWebviewPanel(
            viewType,
            title,
            viewColumn,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.onDispose();
        });
        
        return this.panel;
    }

    setPanel(panel) {
        this.dispose();
        this.panel = panel;
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.onDispose();
        });
    }

    dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    onDispose() {
        // Override in subclasses if needed
    }

    postMessage(message) {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    get isVisible() {
        return this.panel ? this.panel.visible : false;
    }
}

module.exports = EditorBase;
