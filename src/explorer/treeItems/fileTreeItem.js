/**
 * File Tree Item (Refactored)
 * 파일/폴더 트리 아이템
 */

const vscode = require('vscode');
const path = require('path');
const { FOLDER_ICONS } = require('../../core');

class FileTreeItem extends vscode.TreeItem {
    constructor(label, resourceUri, isDirectory, useCustomIcons = false) {
        super(
            label,
            isDirectory 
                ? vscode.TreeItemCollapsibleState.Collapsed 
                : vscode.TreeItemCollapsibleState.None
        );

        this.isDirectory = isDirectory;
        this.resourceUri = vscode.Uri.file(resourceUri);
        this.tooltip = resourceUri;

        if (!isDirectory) {
            this.command = {
                command: 'wizExplorer.openFile',
                title: 'Open File',
                arguments: [this]
            };
        } else if (useCustomIcons) {
            this.setFolderIcon(label.toLowerCase());
        } else {
            this.iconPath = new vscode.ThemeIcon('folder');
        }

        this.contextValue = isDirectory ? 'folder' : 'file';
    }

    setFolderIcon(name) {
        const iconName = FOLDER_ICONS[name] || 'folder';
        this.iconPath = new vscode.ThemeIcon(iconName);
    }
}

module.exports = FileTreeItem;
