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

/**
 * Wiz Settings 카테고리
 * 버전 표시, MCP 설정, Python/npm 패키지 관리 등 설정 메뉴를 그룹화
 */
class SettingsCategory extends CategoryItem {
    constructor(provider) {
        super('wiz settings', 'wizSettings', new vscode.ThemeIcon('gear'));
        this.provider = provider;
        this.contextValue = 'settingsCategory';
        this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    async getChildren() {
        const items = [];
        const version = this.provider.extensionVersion || 'unknown';
        const projectName = this.provider.currentProjectName || 'main';

        // 0. Current Project (copy on click)
        const projectItem = new vscode.TreeItem(`project: ${projectName}`, vscode.TreeItemCollapsibleState.None);
        projectItem.iconPath = new vscode.ThemeIcon('symbol-string');
        projectItem.command = {
            command: 'wizExplorer.copyProjectName',
            title: 'Copy Current Project Name'
        };
        projectItem.contextValue = 'settingsItem';
        items.push(projectItem);

        // 1. Version
        const latestVersion = this.provider.latestVersion;
        const hasUpdate = latestVersion && this._compareVersions(latestVersion, version) > 0;
        const versionLabel = hasUpdate
            ? `version: v${version} → v${latestVersion}`
            : `version: v${version}`;
        const versionItem = new vscode.TreeItem(versionLabel, vscode.TreeItemCollapsibleState.None);
        versionItem.iconPath = new vscode.ThemeIcon(hasUpdate ? 'cloud-download' : 'info');
        versionItem.tooltip = hasUpdate
            ? `새 버전 v${latestVersion} 사용 가능 (현재 v${version}). 클릭하여 업데이트`
            : `Wiz VSCode Extension v${version} (최신)`;
        if (hasUpdate) {
            versionItem.description = '⬆ update';
            versionItem.command = {
                command: 'wizExplorer.updateExtension',
                title: 'Update Extension'
            };
        }
        versionItem.contextValue = 'settingsItem';
        items.push(versionItem);

        // 2. MCP Configuration
        const mcpConfigExists = this.provider.mcpConfigExists;
        const mcpConfigItem = new vscode.TreeItem(
            mcpConfigExists ? 'mcp configuration' : 'mcp configuration (create)',
            vscode.TreeItemCollapsibleState.None
        );
        mcpConfigItem.iconPath = new vscode.ThemeIcon(mcpConfigExists ? 'settings-gear' : 'add');
        mcpConfigItem.command = {
            command: 'wizExplorer.mcpConfigMenu',
            title: 'MCP Configuration'
        };
        mcpConfigItem.contextValue = 'settingsItem';
        items.push(mcpConfigItem);

        // 3. Clean Build
        const cleanBuildItem = new vscode.TreeItem('clean build', vscode.TreeItemCollapsibleState.None);
        cleanBuildItem.iconPath = new vscode.ThemeIcon('trash');
        cleanBuildItem.command = {
            command: 'wizExplorer.cleanBuild',
            title: 'Clean Build'
        };
        cleanBuildItem.contextValue = 'settingsItem';
        items.push(cleanBuildItem);

        // 5. Python Environment
        const pythonEnvItem = new vscode.TreeItem('python env', vscode.TreeItemCollapsibleState.None);
        pythonEnvItem.iconPath = new vscode.ThemeIcon('symbol-misc');
        pythonEnvItem.command = {
            command: 'wizExplorer.selectBuildPythonInterpreter',
            title: 'Select Python Environment'
        };
        pythonEnvItem.contextValue = 'settingsItem';
        items.push(pythonEnvItem);

        // 5. Python Packages (pip)
        const pipItem = new vscode.TreeItem('python packages', vscode.TreeItemCollapsibleState.None);
        pipItem.iconPath = new vscode.ThemeIcon('package');
        pipItem.command = {
            command: 'wizExplorer.openPipManager',
            title: 'pip Package Manager'
        };
        pipItem.contextValue = 'settingsItem';
        items.push(pipItem);

        // 6. npm Packages
        const npmItem = new vscode.TreeItem('npm packages', vscode.TreeItemCollapsibleState.None);
        npmItem.iconPath = new vscode.ThemeIcon('package');
        npmItem.command = {
            command: 'wizExplorer.openNpmManager',
            title: 'npm Package Manager'
        };
        npmItem.contextValue = 'settingsItem';
        items.push(npmItem);

        return items;
    }

    /**
     * 시맨틱 버전 비교
     * @param {string} a
     * @param {string} b
     * @returns {number} a > b: 양수, a < b: 음수, 같으면 0
     */
    _compareVersions(a, b) {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const na = pa[i] || 0;
            const nb = pb[i] || 0;
            if (na !== nb) return na - nb;
        }
        return 0;
    }
}

module.exports = { SourceCategory, PortalCategory, ProjectCategory, CopilotCategory, ConfigCategory, SettingsCategory };
