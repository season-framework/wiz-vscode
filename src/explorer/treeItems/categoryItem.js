const vscode = require('vscode');

class CategoryItem extends vscode.TreeItem {
    constructor(label, id, iconPath) {
        super(label.toLowerCase(), vscode.TreeItemCollapsibleState.Expanded);
        this.id = id;
        this.iconPath = iconPath;
        this.contextValue = 'category';
        this.isDirectory = true;
    }
}

module.exports = CategoryItem;
