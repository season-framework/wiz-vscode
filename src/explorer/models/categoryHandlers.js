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
            { label: 'controller', icon: 'symbol-method', context: 'sourceRootFolder' },
            { label: 'model', icon: 'symbol-method', context: 'sourceRootFolder' },
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

        // 4. Promote angular/libs and angular/styles to source level
        const angularDir = rawItems.find(i => i.label === 'angular' && i.isDirectory);
        if (angularDir) {
            const angularPath = angularDir.resourceUri.fsPath;
            const promotedFolders = [
                { label: 'libs', icon: 'library' },
                { label: 'styles', icon: 'symbol-color' }
            ];
            
            for (const config of promotedFolders) {
                const folderPath = path.join(angularPath, config.label);
                if (fs.existsSync(folderPath)) {
                    const folder = new FileTreeItem(config.label, folderPath, true, false);
                    folder.iconPath = new vscode.ThemeIcon(config.icon);
                    folder.contextValue = 'sourceRootFolder';
                    items.push(folder);
                }
            }
        }

        // 5. Sort items by priority order
        const priority = ['angular', 'app/page', 'app/component', 'app/layout', 'route', 'model', 'controller', 'assets', 'libs', 'styles'];
        items.sort((a, b) => {
            const idxA = priority.indexOf(a.label);
            const idxB = priority.indexOf(b.label);
            
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            
            // Non-priority items: directories first, then alphabetical
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.label.localeCompare(b.label);
        });

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
        return this.provider.getFilesAndFolders(this.provider.workspaceRoot, (item) => item !== 'src' && item !== 'config');
    }
}

class CopilotCategory extends CategoryItem {
    constructor(provider) {
        super('copilot', 'copilot', new vscode.ThemeIcon('copilot'));
        this.provider = provider;
        this.contextValue = 'copilotCategory';
    }

    get resourceUri() {
        if (!this.provider.wizRoot) return undefined;
        return vscode.Uri.file(path.join(this.provider.wizRoot, '.github'));
    }

    set resourceUri(_) {
        // TreeItem 내부 할당 무시 — getter로 동적 반환
    }

    async getChildren() {
        if (!this.provider.wizRoot) return [];
        const githubPath = path.join(this.provider.wizRoot, '.github');
        if (!fs.existsSync(githubPath)) return [];
        return this.provider.getFilesAndFolders(githubPath);
    }
}

class ConfigCategory extends CategoryItem {
    constructor(provider) {
        super('config', 'config', new vscode.ThemeIcon('settings-gear'));
        this.provider = provider;
        this.contextValue = 'configCategory';
    }

    get resourceUri() {
        if (!this.provider.workspaceRoot) return undefined;
        return vscode.Uri.file(path.join(this.provider.workspaceRoot, 'config'));
    }

    set resourceUri(_) {
        // TreeItem 내부 할당 무시 — getter로 동적 반환
    }

    async getChildren() {
        if (!this.provider.workspaceRoot) return [];
        const configPath = path.join(this.provider.workspaceRoot, 'config');
        if (!fs.existsSync(configPath)) return [];
        return this.provider.getFilesAndFolders(configPath);
    }
}

module.exports = { SourceCategory, PortalCategory, ProjectCategory, CopilotCategory, ConfigCategory };
