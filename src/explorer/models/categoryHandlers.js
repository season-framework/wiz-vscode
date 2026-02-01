const path = require('path');
const fs = require('fs');
const CategoryItem = require('../treeItems/categoryItem');
const AppPatternProcessor = require('../appPatternProcessor');

class SourceCategory extends CategoryItem {
    constructor(provider) {
        super('source', 'source', provider.groupIcon);
        this.provider = provider;
    }

    async getChildren() {
        const srcPath = path.join(this.provider.workspaceRoot, 'src');
        if (!fs.existsSync(srcPath)) return [];
        
        const items = this.provider.getFilesAndFolders(srcPath, (item) => item !== 'portal', true);
        return this.applyAppShortcut(items);
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
    }

    async getChildren() {
        const portalPath = path.join(this.provider.workspaceRoot, 'src', 'portal');
        if (!fs.existsSync(portalPath)) return [];
        
        const items = this.provider.getFilesAndFolders(portalPath);
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
        return this.provider.getFilesAndFolders(this.provider.workspaceRoot, (item) => item !== 'src');
    }
}

module.exports = { SourceCategory, PortalCategory, ProjectCategory };
