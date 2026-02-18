const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const FileTreeItem = require('./treeItems/fileTreeItem');
const AppGroupItem = require('./treeItems/appGroupItem');
const EmptyItem = require('./treeItems/emptyItem');
const AppPatternProcessor = require('./appPatternProcessor');
const { SourceCategory, PortalCategory, ProjectCategory, CopilotCategory, ConfigCategory } = require('./models/categoryHandlers');
const { FLAT_APP_TYPES, APP_TYPES, WizPathUtils } = require('../core');

class FileExplorerProvider {
    constructor(workspaceRoot, extensionPath, wizRoot) {
        this.workspaceRoot = workspaceRoot;
        this.extensionPath = extensionPath;
        this.wizRoot = wizRoot;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        /** @private 디바운스된 refresh 타이머 */
        this._pendingRefreshTimer = null;
        
        this.groupIcon = this.extensionPath 
            ? vscode.Uri.file(path.join(this.extensionPath, 'resources', 'icon.svg'))
            : vscode.ThemeIcon.Folder;

        this.categories = [
            new SourceCategory(this),
            new PortalCategory(this),
            new ProjectCategory(this),
            new CopilotCategory(this),
            new ConfigCategory(this)
        ];
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    /**
     * 디바운스된 refresh — 여러 호출이 연속되면 마지막 호출만 실행.
     * getChildren 내부에서 가상 폴더 생성 후 호출하여
     * 다중 setTimeout → refresh 캐스케이드 방지.
     * @private
     */
    _deferRefresh() {
        if (this._pendingRefreshTimer) {
            clearTimeout(this._pendingRefreshTimer);
        }
        this._pendingRefreshTimer = setTimeout(() => {
            this._pendingRefreshTimer = null;
            this.refresh();
        }, 100);
    }

    findItem(filePath) {
        if (!fs.existsSync(filePath)) return null;

        // Try to find if this file is part of an App and return the App Item
        let currentPath = filePath;
        const workspaceRoot = this.workspaceRoot;
        const wizRoot = this.wizRoot;
        
        let loopCount = 0;
        const MAX_LOOP = 50; // Prevent infinite loops in deep structures

        while (currentPath && currentPath !== workspaceRoot && currentPath !== wizRoot && path.dirname(currentPath) !== currentPath) {
             if (loopCount++ > MAX_LOOP) break;
             
             // 1. Check with Path Utilities (Handles Route, Portal App, etc.)
             const { isWizApp } = WizPathUtils.parseAppFolder(currentPath);
             if (isWizApp) {
                 return new FileTreeItem(path.basename(currentPath), currentPath, true);
             }

             // 2. Check Standard App Structure (src/{type}/{name})
             // This handles cases like src/page/home which WizPathUtils might miss
             const parentDir = path.dirname(currentPath);
             const parentName = path.basename(parentDir);
             if (APP_TYPES.includes(parentName)) {
                  // Ensure we are in a valid structure (children of src or src/app or nested comp)
                  return new FileTreeItem(path.basename(currentPath), currentPath, true);
             }
             
             currentPath = parentDir;
        }

        const stat = fs.statSync(filePath);
        return new FileTreeItem(path.basename(filePath), filePath, stat.isDirectory());
    }

    getParent(element) {
        if (!element || this.categories.includes(element)) return null;

        const fsPath = element.resourceUri ? element.resourceUri.fsPath : null;
        if (!fsPath) return null;

        const parentPath = path.dirname(fsPath);
        const name = path.basename(parentPath);
        const grandPath = path.dirname(parentPath);
        
        const srcPath = path.join(this.workspaceRoot, 'src');
        const portalPath = path.join(srcPath, 'portal');

        // 1. Direct Category Children
        if (parentPath === this.workspaceRoot) {
            return this.categories.find(c => c.id === 'project');
        }
        if (parentPath === srcPath) {
             return this.categories.find(c => c.id === 'source');
        }
        if (parentPath === portalPath) {
             return this.categories.find(c => c.id === 'portal');
        }

        // 2. Handling 'app' folder flattening (Source)
        if (name === 'app' && grandPath === srcPath) {
             return this.categories.find(c => c.id === 'source');
        }

        // 3. Handling 'app' folder flattening (Portal)
        if (name === 'app' && path.dirname(grandPath) === portalPath) {
            return new FileTreeItem(path.basename(grandPath), grandPath, true);
        }

        // 4. Default
        return new FileTreeItem(path.basename(parentPath), parentPath, true);
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (!this.workspaceRoot) {
            return [
                new EmptyItem('열린 폴더 없음', 'noFolder'),
                new EmptyItem('폴더 열기...', 'openFolder')
            ];
        }

        if (!element) {
            if (!fs.existsSync(this.workspaceRoot)) {
                return [
                    new EmptyItem(`폴더를 찾을 수 없음: ${path.basename(this.workspaceRoot)}`, 'noFolder'),
                    new EmptyItem('다른 프로젝트 선택...', 'switchProject')
                ];
            }
            return this.categories;
        }

        // 각 아이템 타입별 getChildren 위임
        if (typeof element.getChildren === 'function') {
            return element.getChildren();
        }

        if (element.isDirectory) {
            const dirPath = element.resourceUri.fsPath;
            let items = this.getFilesAndFolders(dirPath);
            const folderName = path.basename(dirPath).toLowerCase();

            // SourceCategory promotes src/angular/libs and src/angular/styles to source root.
            // Exclude them from angular children to keep TreeItem IDs unique.
            const srcAngularPath = path.join(this.workspaceRoot, 'src', 'angular');
            if (dirPath === srcAngularPath) {
                items = items.filter(item => item.label !== 'libs' && item.label !== 'styles');
            }

            // Check if inside a package folder (child of src/portal)
            const portalPath = path.join(this.workspaceRoot, 'src', 'portal');
            if (path.dirname(dirPath) === portalPath) {
                // Define default folders that should always appear
                const defaultFolders = ['app', 'route', 'controller', 'model', 'assets', 'libs', 'styles'];
                
                // Rename portal.json to info and set command to open Portal Info Editor
                const infoItem = items.find(i => i.label === 'portal.json');
                if (infoItem) {
                    infoItem.label = 'info';
                    infoItem.command = {
                        command: 'wizExplorer.openPortalInfo',
                        title: 'Open Portal Info',
                        arguments: [infoItem.resourceUri.fsPath]
                    };
                } else {
                    // Create virtual info item if portal.json doesn't exist
                    const portalJsonPath = path.join(dirPath, 'portal.json');
                    const virtualInfo = new FileTreeItem('info', portalJsonPath, false, false);
                    virtualInfo.iconPath = new vscode.ThemeIcon('json');
                    virtualInfo.description = '(create)';
                    virtualInfo.command = {
                        command: 'wizExplorer.openPortalInfo',
                        title: 'Open Portal Info',
                        arguments: [portalJsonPath]
                    };
                    items.push(virtualInfo);
                }

                // Add missing default folders as virtual items
                for (const folderLabel of defaultFolders) {
                    const exists = items.find(i => i.label === folderLabel);
                    if (!exists) {
                        const folderPath = path.join(dirPath, folderLabel);
                        const virtualFolder = new FileTreeItem(folderLabel, folderPath, true, false);
                        virtualFolder.description = '(create)';
                        items.push(virtualFolder);
                    }
                }

                // Sort: info, app, route, controller, model, assets, libs, styles, then others
                const priority = ['info', 'app', 'route', 'controller', 'model', 'assets', 'libs', 'styles'];
                
                items.sort((a, b) => {
                    const idxA = priority.indexOf(a.label);
                    const idxB = priority.indexOf(b.label);
                    
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    if (idxA !== -1) return -1;
                    if (idxB !== -1) return 1;
                    
                    if (a.isDirectory !== b.isDirectory) {
                        return a.isDirectory ? -1 : 1;
                    }
                    return a.label.localeCompare(b.label);
                });

                // Customize special folder icons and context values
                const specialFolders = {
                    'app': { icon: 'layers', context: 'portalAppGroup' },
                    'route': { icon: 'circuit-board', context: 'portalRouteGroup' },
                    'controller': { icon: 'symbol-method', context: 'folder' },
                    'model': { icon: 'symbol-method', context: 'folder' },
                    'assets': { icon: 'folder-library', context: 'folder' },
                    'libs': { icon: 'library', context: 'folder' },
                    'styles': { icon: 'symbol-color', context: 'folder' }
                };

                for (const [folderName, config] of Object.entries(specialFolders)) {
                    const folder = items.find(i => i.label === folderName);
                    if (folder) {
                        folder.iconPath = new vscode.ThemeIcon(config.icon);
                        folder.contextValue = config.context;
                    }
                }
            }

            // Portal App Handling (app folder under src/portal/*)
            if (folderName === 'app') {
                const parentDir = path.dirname(dirPath);
                const grandParentDir = path.dirname(parentDir);
                if (path.basename(grandParentDir) === 'portal') {
                    // Create folder if it doesn't exist (virtual folder clicked)
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                        this._deferRefresh();
                        return [];
                    }
                    
                    return items.map(item => {
                        if (item.isDirectory) {
                            item.collapsibleState = vscode.TreeItemCollapsibleState.None;
                            item.command = {
                                command: 'wizExplorer.openAppEditor',
                                title: 'Open App Editor',
                                arguments: [item.resourceUri.fsPath, 'portal-app']
                            };
                            item.contextValue = 'appItem';
                        }
                        return item;
                    });
                }
            }

            // Portal Route Handling (route folder under src/portal/*)
            if (folderName === 'route') {
                const parentDir = path.dirname(dirPath);
                const grandParentDir = path.dirname(parentDir);
                if (path.basename(grandParentDir) === 'portal') {
                    // Create folder if it doesn't exist (virtual folder clicked)
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                        this._deferRefresh();
                        return [];
                    }
                }
            }

            // Create virtual folder on expand if it doesn't exist (only for specific types)
            // This prevents infinite loops or accidental creation of arbitrary folders
            if (!fs.existsSync(dirPath)) {
                const basename = path.basename(dirPath);
                
                // Allow creation for standard App types and common forced folders
                const allowedVirtualFolders = [
                    ...APP_TYPES, 
                    'model', 
                    'controller', 
                    'service',
                    'assets',
                    'libs',
                    'styles',
                    'route'
                ];

                if (allowedVirtualFolders.includes(basename)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                    // 디바운스된 refresh로 다중 가상 폴더 생성 시 캐스케이드 방지
                    this._deferRefresh();
                    return [];
                }
            }

            // Flat App Types Handling (e.g. route)
            if (FLAT_APP_TYPES.includes(folderName)) {
                return items.map(item => {
                    if (item.isDirectory) {
                        item.collapsibleState = vscode.TreeItemCollapsibleState.None;
                        item.command = {
                            command: 'wizExplorer.openAppEditor',
                            title: 'Open App Editor',
                            arguments: [item.resourceUri.fsPath, folderName]
                        };
                        item.contextValue = 'appItem';
                    }
                    return item;
                });
            }
            
            if (AppPatternProcessor.hasPattern(items)) {
                return AppPatternProcessor.process(items, dirPath, this.groupIcon);
            }
            return items;
        }

        return [];
    }

    getFilesAndFolders(dirPath, filterFn = null, useCustomIcons = false) {
        if (!fs.existsSync(dirPath)) return [];

        try {
            const items = fs.readdirSync(dirPath).filter(i => !filterFn || filterFn(i));
            return items.map(item => {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                return new FileTreeItem(item, fullPath, stat.isDirectory(), useCustomIcons);
            }).sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.label.localeCompare(b.label);
                return a.isDirectory ? -1 : 1;
            });
        } catch (err) {
            return [];
        }
    }
}

module.exports = FileExplorerProvider;
