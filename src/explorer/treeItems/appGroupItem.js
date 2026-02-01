/**
 * App Group Item (Refactored)
 * App 그룹 트리 아이템 (page, component, layout)
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const FileTreeItem = require('./fileTreeItem');

class AppGroupItem extends vscode.TreeItem {
    constructor(groupType, parentPath, iconPath) {
        const label = `${path.basename(parentPath)}/${groupType}`;
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        
        this.groupType = groupType;
        this.parentPath = parentPath;
        this.iconPath = new vscode.ThemeIcon('layers');
        this.contextValue = 'appGroup';
        this.isDirectory = true;
    }

    getChildren() {
        if (!fs.existsSync(this.parentPath)) return [];
        
        try {
            const prefix = `${this.groupType}.`;
            return fs.readdirSync(this.parentPath)
                .filter(item => item.startsWith(prefix))
                .map(item => this.createAppItem(item, prefix))
                .sort((a, b) => a.label.localeCompare(b.label));
        } catch (err) {
            return [];
        }
    }

    createAppItem(item, prefix) {
        const fullPath = path.join(this.parentPath, item);
        const label = item.substring(prefix.length);
        const stat = fs.statSync(fullPath);
        
        const treeItem = new FileTreeItem(label, fullPath, stat.isDirectory());
        
        if (stat.isDirectory()) {
            let itemLabel = label;

            try {
                const appJsonPath = path.join(fullPath, 'app.json');
                if (fs.existsSync(appJsonPath)) {
                    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                    if (appJson.title) {
                        itemLabel = appJson.title;
                    }
                }
            } catch (e) {
                // Ignore read errors
            }

            treeItem.label = itemLabel;
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.command = {
                command: 'wizExplorer.openAppEditor',
                title: 'Open App Editor',
                arguments: [fullPath, this.groupType]
            };
            treeItem.contextValue = 'appItem';
        }

        return treeItem;
    }
}

module.exports = AppGroupItem;
