const vscode = require('vscode');

class EmptyItem extends vscode.TreeItem {
    constructor(label, type) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = type;
        
        if (type === 'noFolder') {
            this.iconPath = new vscode.ThemeIcon('folder-opened');
        } else if (type === 'openFolder') {
            this.iconPath = new vscode.ThemeIcon('folder');
            this.command = { command: 'wizExplorer.openFolder', title: 'Open Folder' };
        } else if (type === 'switchProject') {
            this.iconPath = new vscode.ThemeIcon('list-unordered');
            this.command = { command: 'wizExplorer.switchProject', title: 'Switch Project' };
        }
    }
}

module.exports = EmptyItem;
