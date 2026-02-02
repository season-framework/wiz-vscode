const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const CategoryItem = require('../treeItems/categoryItem');
const FileTreeItem = require('../treeItems/fileTreeItem');
const AppPatternProcessor = require('../appPatternProcessor');

class SourceCategory extends CategoryItem {
    constructor(provider) {
        super('source', 'source', provider.groupIcon);
        this.provider = provider;
    }

    async getChildren() {
        const srcPath = path.join(this.provider.workspaceRoot, 'src');
        if (!fs.existsSync(srcPath)) return [];
        
        // 1. Get raw items and apply app shortcut first
        const rawItems = this.provider.getFilesAndFolders(srcPath, (item) => item !== 'portal', true);
        const items = this.applyAppShortcut(rawItems);
        
        // 2. Default folders to ensure visible
        const forcedFolders = [
            { label: 'controller', icon: 'symbol-method', context: 'folder' },
            { label: 'model', icon: 'symbol-method', context: 'folder' },
            { label: 'route', icon: 'circuit-board', context: 'routeGroup' }
        ];

        // 3. Inject missing folders and configure icons
        for (const config of forcedFolders) {
            let folder = items.find(item => item.isDirectory && item.label === config.label);
            
            if (!folder) {
                // Determine path: prefer src/app/<name> if src/app exists, else src/<name>
                // We check rawItems for 'app' folder since applyAppShortcut removes it from results
                const appDir = rawItems.find(i => i.label === 'app' && i.isDirectory);
                const basePath = appDir ? appDir.resourceUri.fsPath : srcPath;
                const folderPath = path.join(basePath, config.label);
                
                folder = new FileTreeItem(config.label, folderPath, true, false);
                folder.description = '(create)';
                items.push(folder);
            }

            // Always update icon and context
            folder.iconPath = new vscode.ThemeIcon(config.icon);
            folder.contextValue = config.context;
        }

        return items;
    }

    applyAppShortcut(items) {
        const appDir = items.find(item => item.isDirectory && item.label === 'app');
        if (appDir) {
            const appPath = appDir.resourceUri.fsPath;
            const appItems = this.provider.getFilesAndFolders(appPath);
            const processed = AppPatternProcessor.process(appItems, appPath, this.provider.groupIcon);
            return [...processed, ...items.filter(i => i.label !== 'app')];
        }
        return items;
    }
}

class PortalCategory extends CategoryItem {
    constructor(provider) {
        super('packages', 'portal', provider.groupIcon);
        this.provider = provider;
        this.contextValue = 'portalCategory';
    }

    async getChildren() {
        const portalPath = path.join(this.provider.workspaceRoot, 'src', 'portal');
        if (!fs.existsSync(portalPath)) return [];
        
        const items = this.provider.getFilesAndFolders(portalPath);
        
        // Set contextValue for package folders
        items.forEach(item => {
            if (item.isDirectory) {
                item.contextValue = 'portalPackage';
            }
        });
        
        const appDir = items.find(item => item.isDirectory && item.label === 'app');
        if (appDir) {
            const appPath = appDir.resourceUri.fsPath;
            const appItems = this.provider.getFilesAndFolders(appPath);
            const processed = AppPatternProcessor.process(appItems, appPath, this.provider.groupIcon);
            return [...processed, ...items.filter(i => i.label !== 'app')];
        }
        return items;
    }
}

class ProjectCategory extends CategoryItem {
    constructor(provider) {
        super('project', 'project', provider.groupIcon);
        this.provider = provider;
    }

    async getChildren() {
        return this.provider.getFilesAndFolders(this.provider.workspaceRoot, (item) => item !== 'src' && item !== 'exports');
    }
}

class ExportsCategory extends CategoryItem {
    constructor(provider) {
        super('exports', 'exports', new vscode.ThemeIcon('package'));
        this.provider = provider;
    }

    async getChildren() {
        if (!this.provider.wizRoot) return [];
        const exportsPath = path.join(this.provider.wizRoot, 'exports');
        if (!fs.existsSync(exportsPath)) return [];
        return this.provider.getFilesAndFolders(exportsPath);
    }
}

module.exports = { SourceCategory, PortalCategory, ProjectCategory, ExportsCategory };
