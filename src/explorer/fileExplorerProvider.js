const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const FileTreeItem = require('./treeItems/fileTreeItem');
const AppGroupItem = require('./treeItems/appGroupItem');
const EmptyItem = require('./treeItems/emptyItem');
const AppPatternProcessor = require('./appPatternProcessor');
const { SourceCategory, PortalCategory, ProjectCategory } = require('./models/categoryHandlers');
const { FLAT_APP_TYPES } = require('../core');

class FileExplorerProvider {
    constructor(workspaceRoot, extensionPath) {
        this.workspaceRoot = workspaceRoot;
        this.extensionPath = extensionPath;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        
        this.groupIcon = this.extensionPath 
            ? vscode.Uri.file(path.join(this.extensionPath, 'resources', 'icon.svg'))
            : vscode.ThemeIcon.Folder;

        this.categories = [
            new SourceCategory(this),
            new PortalCategory(this),
            new ProjectCategory(this)
        ];
    }

    refresh() {
        this._onDidChangeTreeData.fire();
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

            // Check if inside a package folder (child of src/portal)
            const portalPath = path.join(this.workspaceRoot, 'src', 'portal');
            if (path.dirname(dirPath) === portalPath) {
                // Rename portal.json to info and set command to open Portal Info Editor
                const infoItem = items.find(i => i.label === 'portal.json');
                if (infoItem) {
                    infoItem.label = 'info';
                    infoItem.command = {
                        command: 'wizExplorer.openPortalInfo',
                        title: 'Open Portal Info',
                        arguments: [infoItem.resourceUri.fsPath]
                    };
                }

                // Sort: info, app, route, controller, model, then others
                const priority = ['info', 'app', 'route', 'controller', 'model'];
                
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
                    'route': { icon: 'circuit-board', context: 'folder' },
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
                    // This is the container folder "src/portal/<pkg>/app"
                    // We need to mark THIS element as a portalAppGroup, but getChildren is returning its children.
                    // The parent element (which triggered getChildren) is likely a FileTreeItem representing 'app'.
                    // So we can't change the parent element's contextValue here directly if we are just returning children.
                    
                    // Actually, 'getChildren' is called for an element. 
                    // To set contextValue for the 'app' folder, we need to do it when the 'app' folder item ITSELF is created.
                    // That happens when we process the parent package folder.
                    
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
