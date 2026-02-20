/**
 * Wiz MCP Server
 * Model Context Protocol server for AI agent integration
 * 
 * AI 에이전트가 Wiz 프로젝트를 탐색, 생성, 수정, 빌드할 수 있도록
 * 포괄적인 도구 세트를 제공합니다.
 * 
 * Tool Categories:
 *   - Project Management (5): 프로젝트 조회, 전환, 내보내기, 가져오기
 *   - Build (1): 프로젝트 빌드 (normal/clean)
 *   - App Management (9): 앱/라우트/포탈앱/포탈라우트 CRUD
 *   - Package Management (3): 포탈 패키지 관리
 *   - Dependency Management (6): pip/npm 패키지 설치, 제거, 목록 조회
 *   - File System (7): 범용 파일/폴더 읽기, 쓰기, 삭제, 이름변경
 *   - App File Shortcuts (2): 앱 폴더 내 파일 바로가기
 *   - Development Helpers (3): 컨트롤러/레이아웃 목록, 앱 검색
 */

const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const util = require('util');
const exec = util.promisify(cp.exec);

// App 기본 템플릿 (core/constants.js와 동일)
const APP_TEMPLATES = {
    'view.html': '<div>Hello, World!</div>',
    'view.ts': `import { OnInit, Input } from '@angular/core';

export class Component implements OnInit {
    @Input() title: any;

    public async ngOnInit() {
    }
}`,
    'view.scss': ''
};

class WizMcpServer {
    constructor() {
        this.server = new Server(
            {
                name: 'wiz-mcp-server',
                version: '2.0.0'
            },
            {
                capabilities: {
                    tools: {},
                    resources: {}
                }
            }
        );

        // 환경변수에서 초기값 로드
        this.wizRoot = process.env.WIZ_WORKSPACE || null;
        this.currentProject = process.env.WIZ_PROJECT || 'main';

        // Extension 상태 파일에서 최신 프로젝트 동기화
        this._loadState();

        this.setupHandlers();
    }

    // ==================== Helper Methods ====================

    /**
     * 프로젝트 src 경로 반환
     */
    _getSrcPath(workspacePath, projectName) {
        return path.join(workspacePath, 'project', projectName, 'src');
    }

    /**
     * 앱 부모 경로 반환 (src/app 또는 src)
     */
    _getAppParentPath(srcPath) {
        const appDir = path.join(srcPath, 'app');
        if (fs.existsSync(appDir) && fs.statSync(appDir).isDirectory()) {
            return appDir;
        }
        return srcPath;
    }

    /**
     * 디렉토리 트리 생성 (재귀)
     */
    _buildTree(dirPath, options = {}) {
        const { maxDepth = 5, currentDepth = 0, includeFiles = true } = options;
        if (currentDepth >= maxDepth) return { '...': 'max depth reached' };

        const result = {};
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            // 디렉토리 먼저, 그 다음 파일
            const sorted = entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of sorted) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '__pycache__') continue;
                
                if (entry.isDirectory()) {
                    result[entry.name + '/'] = this._buildTree(
                        path.join(dirPath, entry.name),
                        { maxDepth, currentDepth: currentDepth + 1, includeFiles }
                    );
                } else if (includeFiles) {
                    const stat = fs.statSync(path.join(dirPath, entry.name));
                    result[entry.name] = stat.size;
                }
            }
        } catch (e) { /* skip inaccessible dirs */ }
        return result;
    }

    /**
     * 앱 스캔 헬퍼
     */
    _scanApps(dirPath, category) {
        const apps = [];
        if (!fs.existsSync(dirPath)) return apps;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const appJsonPath = path.join(dirPath, entry.name, 'app.json');
                    if (fs.existsSync(appJsonPath)) {
                        try {
                            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                            const files = fs.readdirSync(path.join(dirPath, entry.name));
                            apps.push({
                                name: entry.name,
                                path: path.join(dirPath, entry.name),
                                category,
                                files,
                                ...appJson
                            });
                        } catch (e) { /* skip invalid json */ }
                    }
                }
            }
        } catch (e) { /* skip inaccessible dirs */ }
        return apps;
    }

    /**
     * JSON 결과 래핑
     */
    _jsonResult(data) {
        return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
        };
    }

    /**
     * 상태 파일 경로 반환
     * Extension이 기록하는 .vscode/.wiz-state.json
     */
    _getStatePath() {
        if (!this.wizRoot) return null;
        return path.join(this.wizRoot, '.vscode', '.wiz-state.json');
    }

    /**
     * Extension 상태 파일에서 현재 프로젝트 로드
     * Explorer에서 선택된 프로젝트와 동기화
     */
    _loadState() {
        try {
            const statePath = this._getStatePath();
            if (statePath && fs.existsSync(statePath)) {
                const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                if (state.currentProject) this.currentProject = state.currentProject;
                if (state.workspacePath) this.wizRoot = state.workspacePath;
            }
        } catch (e) { /* skip invalid state */ }
    }

    /**
     * 상태 파일에 현재 상태 저장 (MCP에서 프로젝트 전환 시)
     */
    _saveState() {
        try {
            const statePath = this._getStatePath();
            if (!statePath) return;
            const dir = path.dirname(statePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(statePath, JSON.stringify({
                workspacePath: this.wizRoot,
                currentProject: this.currentProject
            }, null, 2), 'utf8');
        } catch (e) { /* skip */ }
    }

    /**
     * 상대 경로를 프로젝트 루트 기준 절대 경로로 변환
     * - 이미 절대 경로('/'로 시작)면 그대로 반환
     * - 'src/'로 시작하면 {projectRoot}/src/... 로 변환
     * - 그 외 상대 경로면 {projectRoot}/src/ 기준으로 변환 (Wiz 소스는 모두 src/ 하위)
     *   단, {projectRoot}/{path}가 존재하면 그것을 우선 사용
     */
    _resolvePath(p, workspacePath, projectName) {
        if (!p || typeof p !== 'string') return p;
        if (path.isAbsolute(p)) return p;

        const projectRoot = path.join(workspacePath, 'project', projectName);

        // src/로 시작하면 프로젝트 루트에서 바로 연결
        if (p.startsWith('src/') || p.startsWith('src\\')) {
            return path.join(projectRoot, p);
        }

        // 프로젝트 루트 직접 경로가 존재하면 우선 사용 (예: package.json 등)
        const directPath = path.join(projectRoot, p);
        if (fs.existsSync(directPath)) {
            return directPath;
        }

        // 기본: src/ 하위로 변환 (portal/, app/, route/ 등 소스 경로)
        return path.join(projectRoot, 'src', p);
    }

    /**
     * Tool 인자에 workspacePath/projectName 자동 주입 + 경로 파라미터 절대경로 변환
     * 매 호출 시 상태 파일에서 최신 값 로드
     */
    _resolveArgs(args) {
        this._loadState();
        const workspacePath = args.workspacePath || this.wizRoot;
        const projectName = args.projectName || this.currentProject;

        const resolved = { ...args, workspacePath, projectName };

        // 경로 파라미터를 프로젝트 루트 기준 절대 경로로 변환
        const pathKeys = ['appPath', 'dirPath', 'filePath', 'targetPath', 'folderPath', 'oldPath', 'newPath'];
        for (const key of pathKeys) {
            if (resolved[key]) {
                resolved[key] = this._resolvePath(resolved[key], workspacePath, projectName);
            }
        }

        return resolved;
    }

    // ==================== Handler Setup ====================

    setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return { tools: this._getToolDefinitions() };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                const handler = this._getToolHandler(name);
                if (!handler) throw new Error(`Unknown tool: ${name}`);
                // workspacePath/projectName 자동 주입 (Explorer 연동)
                const resolvedArgs = this._resolveArgs(args || {});
                return await handler.call(this, resolvedArgs);
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `Error: ${error.message}` }],
                    isError: true
                };
            }
        });

        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return { resources: [] };
        });

        this.server.setRequestHandler(ReadResourceRequestSchema, async () => {
            return { contents: [] };
        });
    }

    _getToolHandler(name) {
        const handlers = {
            // Workspace State
            wiz_get_workspace_state: this.getWorkspaceState,
            // Project Management
            wiz_get_project_info: this.getProjectInfo,
            wiz_list_projects: this.listProjects,
            wiz_switch_project: this.switchProject,
            wiz_export_project: this.exportProject,
            wiz_import_project: this.importProject,
            // Build
            wiz_build: this.build,
            // App Management
            wiz_list_apps: this.listApps,
            wiz_get_app_info: this.getAppInfo,
            wiz_create_app: this.createApp,
            wiz_create_route: this.createRoute,
            wiz_create_portal_app: this.createPortalApp,
            wiz_create_portal_route: this.createPortalRoute,
            wiz_update_app: this.updateApp,
            wiz_delete_app: this.deleteApp,
            wiz_search_apps: this.searchApps,
            // Package Management
            wiz_list_packages: this.listPackages,
            wiz_create_package: this.createPackage,
            wiz_export_package: this.exportPackage,
            // Dependency Management (pip / npm)
            wiz_pip_list: this.pipList,
            wiz_pip_install: this.pipInstall,
            wiz_pip_uninstall: this.pipUninstall,
            wiz_npm_list: this.npmList,
            wiz_npm_install: this.npmInstall,
            wiz_npm_uninstall: this.npmUninstall,
            // File System Operations
            wiz_get_project_structure: this.getProjectStructure,
            wiz_list_directory: this.listDirectory,
            wiz_read_file: this.readFile,
            wiz_write_file: this.writeFile,
            wiz_create_folder: this.createFolder,
            wiz_delete_file: this.deleteFile,
            wiz_rename_file: this.renameFile,
            // App File Shortcuts
            wiz_read_app_file: this.readAppFile,
            wiz_write_app_file: this.writeAppFile,
            // Development Helpers
            wiz_list_controllers: this.listControllers,
            wiz_list_layouts: this.listLayouts,
        };
        return handlers[name];
    }

    _getToolDefinitions() {
        const tools = [
            // ==================== Workspace State ====================
            {
                name: 'wiz_get_workspace_state',
                description: 'Get the current workspace state synced from VS Code Explorer. Returns the active workspacePath and projectName. Call this first to understand the current context. The state is automatically synced when the user switches projects in the Explorer.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },

            // ==================== Project Management ====================
            {
                name: 'wiz_get_project_info',
                description: 'Get comprehensive information about the current Wiz project including directory structure overview, available app types, package list, and project paths. Call this first to understand the project before making changes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root (contains project/ folder)'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project (e.g., "main")'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_list_projects',
                description: 'List all available Wiz projects in the workspace. Projects are stored under {workspacePath}/project/ directory.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        }
                    },
                    required: ['workspacePath']
                }
            },
            {
                name: 'wiz_switch_project',
                description: 'Switch the MCP server context to a different Wiz project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project to switch to'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_export_project',
                description: 'Export a Wiz project as .wizproject archive file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project to export'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_import_project',
                description: 'Import a .wizproject file into the workspace as a new project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        filePath: {
                            type: 'string',
                            description: 'Path to the .wizproject file to import'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name for the imported project'
                        }
                    },
                    required: ['workspacePath', 'filePath', 'projectName']
                }
            },

            // ==================== Build ====================
            {
                name: 'wiz_build',
                description: 'Build a Wiz project. Use clean=true for a fresh rebuild. Build compiles source files in src/ into deployable output.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project to build'
                        },
                        clean: {
                            type: 'boolean',
                            description: 'If true, perform a clean build (removes previous build artifacts first)',
                            default: false
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },

            // ==================== App Management ====================
            {
                name: 'wiz_list_apps',
                description: 'List all apps in a Wiz project. Returns app metadata (id, title, namespace, mode, category) and file list for each app. Apps can be in src/app/ (prefixed like page.xxx), src/{type}/, or src/portal/{package}/app/.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        appType: {
                            type: 'string',
                            enum: ['all', 'page', 'component', 'layout', 'route'],
                            description: 'Filter by app type. Use "all" to list every app.',
                            default: 'all'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_get_app_info',
                description: 'Get detailed information about a specific app including its app.json config and list of all files in the app folder. Use this to understand an app before editing.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        appPath: {
                            type: 'string',
                            description: 'Full absolute path to the app folder (e.g., /path/to/project/main/src/app/page.home)'
                        }
                    },
                    required: ['appPath']
                }
            },
            {
                name: 'wiz_create_app',
                description: 'Create a new standard Wiz app (page, component, or layout). Creates the app folder with app.json, view.html, and view.ts files. Standard apps are placed in src/app/ with prefix like "page.myapp".',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        appType: {
                            type: 'string',
                            enum: ['page', 'component', 'layout'],
                            description: 'Type of app to create'
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace (lowercase letters, numbers, underscores, must start with letter). Used as folder suffix: {appType}.{namespace}'
                        },
                        title: {
                            type: 'string',
                            description: 'Display title for the app. Defaults to namespace if not provided.'
                        },
                        category: {
                            type: 'string',
                            description: 'Category grouping. Defaults to namespace if not provided.'
                        },
                        controller: {
                            type: 'string',
                            description: 'Python controller name to bind (without .py extension). Leave empty for none.'
                        },
                        layout: {
                            type: 'string',
                            description: 'Layout app ID to use (page type only, e.g., "layout.main"). Leave empty for none.'
                        },
                        viewuri: {
                            type: 'string',
                            description: 'Angular routing viewURI (page type only, e.g., "/home"). Leave empty for none.'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'appType', 'namespace']
                }
            },
            {
                name: 'wiz_create_route',
                description: 'Create a new standard Wiz route (API endpoint). Creates the route folder in src/route/ with app.json and controller.py. Routes are backend API handlers.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        id: {
                            type: 'string',
                            description: 'Route ID (folder name, lowercase letters and numbers only)'
                        },
                        title: {
                            type: 'string',
                            description: 'Display title for the route. Defaults to id.'
                        },
                        routePath: {
                            type: 'string',
                            description: 'API route path (e.g., /api/users). This is the URL endpoint.'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'id']
                }
            },
            {
                name: 'wiz_create_portal_app',
                description: 'Create a new Portal App inside a portal package. Portal apps are located in src/portal/{package}/app/{namespace}. Creates app.json, view.html, view.ts, and view.scss. The folder name equals the namespace.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        packageName: {
                            type: 'string',
                            description: 'Name of the portal package (folder name under src/portal/)'
                        },
                        namespace: {
                            type: 'string',
                            description: 'Namespace for the portal app (lowercase letters, numbers, underscores). Becomes the folder name.'
                        },
                        title: {
                            type: 'string',
                            description: 'Display title. Defaults to namespace.'
                        },
                        category: {
                            type: 'string',
                            description: 'Category grouping. Defaults to "editor".'
                        },
                        controller: {
                            type: 'string',
                            description: 'Python controller name (without .py). Leave empty for none.'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'packageName', 'namespace']
                }
            },
            {
                name: 'wiz_create_portal_route',
                description: 'Create a new Portal Route inside a portal package. Portal routes are located in src/portal/{package}/route/{id}. Creates app.json and controller.py.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        packageName: {
                            type: 'string',
                            description: 'Name of the portal package'
                        },
                        id: {
                            type: 'string',
                            description: 'Route ID (folder name, lowercase letters and numbers)'
                        },
                        title: {
                            type: 'string',
                            description: 'Display title. Defaults to id.'
                        },
                        routePath: {
                            type: 'string',
                            description: 'API route path (e.g., /api/portal/example)'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'packageName', 'id']
                }
            },
            {
                name: 'wiz_update_app',
                description: 'Update the app.json configuration for an app. Merges the provided key-value pairs into the existing app.json. Use this to change title, namespace, category, controller, viewuri, layout, route, etc.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        appPath: {
                            type: 'string',
                            description: 'Full absolute path to the app folder'
                        },
                        updates: {
                            type: 'object',
                            description: 'Key-value pairs to merge into app.json (e.g., {"title": "New Title", "controller": "mycontroller"})'
                        }
                    },
                    required: ['appPath', 'updates']
                }
            },
            {
                name: 'wiz_delete_app',
                description: 'Delete an app or route folder and all its contents. This is irreversible.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        appPath: {
                            type: 'string',
                            description: 'Full absolute path to the app folder to delete'
                        }
                    },
                    required: ['appPath']
                }
            },
            {
                name: 'wiz_search_apps',
                description: 'Search for apps by keyword across all app names, titles, namespaces, and categories. Returns matching apps with their full paths and metadata.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        query: {
                            type: 'string',
                            description: 'Search keyword (case-insensitive). Matches against app name, title, namespace, id, and category.'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'query']
                }
            },

            // ==================== Package Management ====================
            {
                name: 'wiz_list_packages',
                description: 'List all portal packages in a project. Packages are located in src/portal/ and contain app/, route/, controller/, model/, assets/, libs/, styles/ sub-folders.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_create_package',
                description: 'Create a new portal package using the wiz CLI. The package will be created at src/portal/{namespace}/ with standard sub-folders.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        namespace: {
                            type: 'string',
                            description: 'Package namespace (lowercase letters and numbers only, starts with letter)'
                        },
                        title: {
                            type: 'string',
                            description: 'Display title for the package'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'namespace']
                }
            },
            {
                name: 'wiz_export_package',
                description: 'Export a portal package as a .wizpkg archive file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        packageName: {
                            type: 'string',
                            description: 'Name of the package to export'
                        }
                    },
                    required: ['workspacePath', 'projectName', 'packageName']
                }
            },

            // ==================== Dependency Management (pip / npm) ====================
            {
                name: 'wiz_pip_list',
                description: 'List installed Python pip packages in the Wiz workspace virtual environment. Returns package names and versions.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        outdated: {
                            type: 'boolean',
                            description: 'If true, list only outdated packages with current and latest versions',
                            default: false
                        }
                    },
                    required: ['workspacePath']
                }
            },
            {
                name: 'wiz_pip_install',
                description: 'Install Python pip package(s) in the Wiz workspace virtual environment. Supports version specifiers (e.g., "flask>=2.0", "requests==2.28.0").',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        packages: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of package names to install (e.g., ["flask", "requests>=2.28"])'
                        },
                        upgrade: {
                            type: 'boolean',
                            description: 'If true, upgrade packages to the latest version',
                            default: false
                        }
                    },
                    required: ['workspacePath', 'packages']
                }
            },
            {
                name: 'wiz_pip_uninstall',
                description: 'Uninstall Python pip package(s) from the Wiz workspace virtual environment.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        packages: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of package names to uninstall'
                        }
                    },
                    required: ['workspacePath', 'packages']
                }
            },
            {
                name: 'wiz_npm_list',
                description: 'List installed npm packages in the Wiz project. Returns package names and versions from the project-level node_modules.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        global: {
                            type: 'boolean',
                            description: 'If true, list workspace-level packages instead of project-level',
                            default: false
                        },
                        outdated: {
                            type: 'boolean',
                            description: 'If true, list only outdated packages with current/wanted/latest versions',
                            default: false
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_npm_install',
                description: 'Install npm package(s) in the Wiz project. Supports version specifiers (e.g., "lodash@4.17.21"). Installs to the project directory by default.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        packages: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of package names to install (e.g., ["lodash", "axios@1.6.0"])'
                        },
                        dev: {
                            type: 'boolean',
                            description: 'If true, install as devDependencies (--save-dev)',
                            default: false
                        },
                        global: {
                            type: 'boolean',
                            description: 'If true, install to workspace root instead of project directory',
                            default: false
                        }
                    },
                    required: ['workspacePath', 'projectName', 'packages']
                }
            },
            {
                name: 'wiz_npm_uninstall',
                description: 'Uninstall npm package(s) from the Wiz project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        packages: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'List of package names to uninstall'
                        },
                        global: {
                            type: 'boolean',
                            description: 'If true, uninstall from workspace root instead of project directory',
                            default: false
                        }
                    },
                    required: ['workspacePath', 'projectName', 'packages']
                }
            },

            // ==================== File System Operations ====================
            {
                name: 'wiz_get_project_structure',
                description: 'Get the directory tree structure of a Wiz project. Returns a nested object showing all folders and files with their sizes. Use this to understand the project layout before navigating.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        maxDepth: {
                            type: 'number',
                            description: 'Maximum directory depth to traverse (default: 4)',
                            default: 4
                        },
                        subPath: {
                            type: 'string',
                            description: 'Optional sub-path relative to project src/ to start from (e.g., "portal/mypackage"). Defaults to src/ root.'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_list_directory',
                description: 'List contents of any directory. Returns file names, types (file/directory), and sizes. Works with any absolute path.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dirPath: {
                            type: 'string',
                            description: 'Absolute path to the directory to list'
                        }
                    },
                    required: ['dirPath']
                }
            },
            {
                name: 'wiz_read_file',
                description: 'Read the contents of any file by absolute path. For text files returns the content as string. Supports optional line range for large files.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the file to read'
                        },
                        startLine: {
                            type: 'number',
                            description: 'Start reading from this line number (1-based). Omit to read from beginning.'
                        },
                        endLine: {
                            type: 'number',
                            description: 'Stop reading at this line number (1-based, inclusive). Omit to read to end.'
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'wiz_write_file',
                description: 'Write content to any file by absolute path. Creates the file if it does not exist (including parent directories). Overwrites existing content.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the file to write'
                        },
                        content: {
                            type: 'string',
                            description: 'Content to write to the file'
                        }
                    },
                    required: ['filePath', 'content']
                }
            },
            {
                name: 'wiz_create_folder',
                description: 'Create a new directory (with parent directories as needed)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        folderPath: {
                            type: 'string',
                            description: 'Absolute path of the directory to create'
                        }
                    },
                    required: ['folderPath']
                }
            },
            {
                name: 'wiz_delete_file',
                description: 'Delete a file or directory (recursively). This is irreversible.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        targetPath: {
                            type: 'string',
                            description: 'Absolute path to the file or directory to delete'
                        }
                    },
                    required: ['targetPath']
                }
            },
            {
                name: 'wiz_rename_file',
                description: 'Rename or move a file or directory',
                inputSchema: {
                    type: 'object',
                    properties: {
                        oldPath: {
                            type: 'string',
                            description: 'Current absolute path of the file or directory'
                        },
                        newPath: {
                            type: 'string',
                            description: 'New absolute path (for rename, keep same parent; for move, change parent)'
                        }
                    },
                    required: ['oldPath', 'newPath']
                }
            },

            // ==================== App File Shortcuts ====================
            {
                name: 'wiz_read_app_file',
                description: 'Shorthand to read a specific file from an app folder. Combines appPath + fileName. Common files: app.json, view.html, view.pug, view.ts, view.scss, controller.py, api.py, socket.py.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        appPath: {
                            type: 'string',
                            description: 'Full path to the app folder'
                        },
                        fileName: {
                            type: 'string',
                            description: 'Name of the file to read (e.g., "view.html", "view.ts", "controller.py", "api.py")'
                        }
                    },
                    required: ['appPath', 'fileName']
                }
            },
            {
                name: 'wiz_write_app_file',
                description: 'Shorthand to write content to a file inside an app folder. Creates the file if it does not exist.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        appPath: {
                            type: 'string',
                            description: 'Full path to the app folder'
                        },
                        fileName: {
                            type: 'string',
                            description: 'Name of the file to write (e.g., "view.html", "view.ts", "controller.py")'
                        },
                        content: {
                            type: 'string',
                            description: 'Content to write to the file'
                        }
                    },
                    required: ['appPath', 'fileName', 'content']
                }
            },

            // ==================== Development Helpers ====================
            {
                name: 'wiz_list_controllers',
                description: 'List available Python controllers in the project. Controllers are .py files in src/controller/ (standard) or src/portal/{package}/controller/ (portal).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        },
                        packageName: {
                            type: 'string',
                            description: 'Optional: portal package name. If provided, lists controllers from that package instead of the standard controller directory.'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            },
            {
                name: 'wiz_list_layouts',
                description: 'List available layout apps in the project. Layouts are apps with folder names starting with "layout." (e.g., layout.main). Used when creating page apps to set the layout.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspacePath: {
                            type: 'string',
                            description: 'Path to the Wiz workspace root'
                        },
                        projectName: {
                            type: 'string',
                            description: 'Name of the project'
                        }
                    },
                    required: ['workspacePath', 'projectName']
                }
            }
        ];

        // workspacePath/projectName을 optional로 변환 (Explorer 자동 연동)
        // 경로 파라미터에 상대경로 지원 안내 추가
        const pathParamKeys = ['appPath', 'dirPath', 'filePath', 'targetPath', 'folderPath', 'oldPath', 'newPath'];
        for (const tool of tools) {
            const props = tool.inputSchema.properties;
            if (props.workspacePath) {
                props.workspacePath.description += ' (auto-detected from VS Code Explorer if omitted)';
            }
            if (props.projectName) {
                props.projectName.description += ' (auto-detected from VS Code Explorer if omitted)';
            }
            // 경로 파라미터: 상대경로 → 프로젝트 루트 기준 절대경로로 자동 변환됨을 안내
            for (const key of pathParamKeys) {
                if (props[key]) {
                    props[key].description += ' (relative paths like "src/portal/pkg/app/name" are auto-resolved to the project root)';
                }
            }
            if (tool.inputSchema.required) {
                tool.inputSchema.required = tool.inputSchema.required.filter(
                    r => r !== 'workspacePath' && r !== 'projectName'
                );
            }
        }

        return tools;
    }

    // ==================== Workspace State ====================

    async getWorkspaceState() {
        this._loadState();
        return this._jsonResult({
            workspacePath: this.wizRoot,
            currentProject: this.currentProject,
            projectSrcPath: this.wizRoot ? this._getSrcPath(this.wizRoot, this.currentProject) : null,
            note: 'This state is synced from VS Code Explorer. workspacePath and projectName are auto-injected into all tool calls.'
        });
    }

    // ==================== Project Management ====================

    async getProjectInfo({ workspacePath, projectName }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const projectPath = path.join(workspacePath, 'project', projectName);

        if (!fs.existsSync(projectPath)) {
            throw new Error(`Project '${projectName}' does not exist at ${projectPath}`);
        }

        // 프로젝트 목록
        const projectBasePath = path.join(workspacePath, 'project');
        const allProjects = fs.existsSync(projectBasePath)
            ? fs.readdirSync(projectBasePath, { withFileTypes: true })
                .filter(e => e.isDirectory()).map(e => e.name)
            : [];

        // 앱 수 카운트
        const appCounts = { page: 0, component: 0, layout: 0, route: 0, portalApp: 0, portalRoute: 0 };
        
        if (fs.existsSync(srcPath)) {
            // Standard apps (src/app/)
            const appDir = path.join(srcPath, 'app');
            if (fs.existsSync(appDir)) {
                try {
                    const entries = fs.readdirSync(appDir, { withFileTypes: true });
                    for (const e of entries) {
                        if (e.isDirectory()) {
                            if (e.name.startsWith('page.')) appCounts.page++;
                            else if (e.name.startsWith('component.')) appCounts.component++;
                            else if (e.name.startsWith('layout.')) appCounts.layout++;
                        }
                    }
                } catch (e) { /* skip */ }
            }

            // Standard apps in individual type folders
            for (const type of ['page', 'component', 'layout']) {
                const typeDir = path.join(srcPath, type);
                if (fs.existsSync(typeDir)) {
                    try {
                        const entries = fs.readdirSync(typeDir, { withFileTypes: true });
                        appCounts[type] += entries.filter(e => e.isDirectory()).length;
                    } catch (e) { /* skip */ }
                }
            }

            // Routes
            const routeDir = path.join(srcPath, 'route');
            if (fs.existsSync(routeDir)) {
                try {
                    appCounts.route = fs.readdirSync(routeDir, { withFileTypes: true })
                        .filter(e => e.isDirectory()).length;
                } catch (e) { /* skip */ }
            }

            // Portal packages
            const portalPath = path.join(srcPath, 'portal');
            if (fs.existsSync(portalPath)) {
                try {
                    const packages = fs.readdirSync(portalPath, { withFileTypes: true })
                        .filter(e => e.isDirectory());
                    for (const pkg of packages) {
                        const pkgAppDir = path.join(portalPath, pkg.name, 'app');
                        const pkgRouteDir = path.join(portalPath, pkg.name, 'route');
                        if (fs.existsSync(pkgAppDir)) {
                            appCounts.portalApp += fs.readdirSync(pkgAppDir, { withFileTypes: true })
                                .filter(e => e.isDirectory()).length;
                        }
                        if (fs.existsSync(pkgRouteDir)) {
                            appCounts.portalRoute += fs.readdirSync(pkgRouteDir, { withFileTypes: true })
                                .filter(e => e.isDirectory()).length;
                        }
                    }
                } catch (e) { /* skip */ }
            }
        }

        // 패키지 목록
        const portalPath = path.join(srcPath, 'portal');
        const packages = [];
        if (fs.existsSync(portalPath)) {
            try {
                const entries = fs.readdirSync(portalPath, { withFileTypes: true });
                for (const e of entries) {
                    if (e.isDirectory()) {
                        const pjPath = path.join(portalPath, e.name, 'portal.json');
                        let info = { name: e.name };
                        if (fs.existsSync(pjPath)) {
                            try { info = { ...info, ...JSON.parse(fs.readFileSync(pjPath, 'utf8')) }; } catch (e) { /* skip */ }
                        }
                        packages.push(info);
                    }
                }
            } catch (e) { /* skip */ }
        }

        // src 디렉토리 최상위 구조
        const srcStructure = {};
        if (fs.existsSync(srcPath)) {
            try {
                const entries = fs.readdirSync(srcPath, { withFileTypes: true });
                for (const e of entries) {
                    srcStructure[e.name] = e.isDirectory() ? 'directory' : 'file';
                }
            } catch (e) { /* skip */ }
        }

        return this._jsonResult({
            project: projectName,
            allProjects,
            paths: {
                workspace: workspacePath,
                project: projectPath,
                src: srcPath
            },
            appCounts,
            packages,
            srcStructure,
            fileTypes: {
                standard: 'App files: app.json (config), view.html/view.pug (UI template), view.ts (Angular component), view.scss (styles), controller.py (backend controller), api.py (API handler), socket.py (WebSocket handler)',
                route: 'Route files: app.json (config), controller.py (request handler)'
            }
        });
    }

    async listProjects({ workspacePath }) {
        const projectPath = path.join(workspacePath, 'project');
        if (!fs.existsSync(projectPath)) {
            return this._jsonResult({ projects: [], message: 'No project folder found' });
        }

        const projects = fs.readdirSync(projectPath, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);

        return this._jsonResult({ projects, currentProject: this.currentProject });
    }

    async switchProject({ workspacePath, projectName }) {
        const projectPath = path.join(workspacePath, 'project', projectName);
        if (!fs.existsSync(projectPath)) {
            throw new Error(`Project '${projectName}' does not exist`);
        }

        this.currentProject = projectName;
        this.wizRoot = workspacePath;

        // 상태 파일에 저장하여 Extension과 동기화
        this._saveState();

        return this._jsonResult({ success: true, currentProject: projectName });
    }

    async exportProject({ workspacePath, projectName }) {
        const exportsPath = path.join(workspacePath, 'exports');
        if (!fs.existsSync(exportsPath)) {
            fs.mkdirSync(exportsPath, { recursive: true });
        }

        const outputPath = path.join(exportsPath, projectName);
        const command = `wiz project export --project=${projectName} --output="${outputPath}"`;

        await exec(command, { cwd: workspacePath });

        return this._jsonResult({ success: true, outputPath: `${outputPath}.wizproject` });
    }

    async importProject({ workspacePath, filePath, projectName }) {
        const projectBasePath = path.join(workspacePath, 'project');
        const targetPath = path.join(projectBasePath, projectName);

        if (fs.existsSync(targetPath)) {
            throw new Error(`Project '${projectName}' already exists`);
        }

        fs.mkdirSync(targetPath, { recursive: true });
        await exec(`unzip -o "${filePath}" -d "${targetPath}"`);

        return this._jsonResult({ success: true, projectPath: targetPath });
    }

    // ==================== Build ====================

    async build({ workspacePath, projectName, clean = false }) {
        const args = ['project', 'build', '--project', projectName];
        if (clean) args.push('--clean');

        const { stdout, stderr } = await exec(`wiz ${args.join(' ')}`, { cwd: workspacePath });

        return this._jsonResult({ success: true, output: stdout, errors: stderr || null });
    }

    // ==================== App Management ====================

    async listApps({ workspacePath, projectName, appType = 'all' }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        let allApps = [];

        const typesToScan = appType === 'all'
            ? ['page', 'component', 'layout', 'route']
            : [appType];

        // Scan src/app/ (prefixed: page.xxx, component.xxx, layout.xxx)
        const appDir = path.join(srcPath, 'app');
        if (fs.existsSync(appDir)) {
            for (const type of typesToScan) {
                if (type !== 'route') {
                    try {
                        const entries = fs.readdirSync(appDir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.isDirectory() && entry.name.startsWith(`${type}.`)) {
                                const apps = this._scanApps(appDir, type);
                                const filtered = apps.filter(a => a.name.startsWith(`${type}.`));
                                allApps.push(...filtered);
                            }
                        }
                    } catch (e) { /* skip */ }
                }
            }
            // De-duplicate by path
            const seen = new Set();
            allApps = allApps.filter(app => {
                if (seen.has(app.path)) return false;
                seen.add(app.path);
                return true;
            });
        }

        // Scan individual type directories (src/page/, src/component/, etc.)
        for (const type of typesToScan) {
            if (type !== 'route') {
                const typeDir = path.join(srcPath, type);
                if (fs.existsSync(typeDir)) {
                    allApps.push(...this._scanApps(typeDir, type));
                }
            }
        }

        // Scan route folder
        if (typesToScan.includes('route')) {
            allApps.push(...this._scanApps(path.join(srcPath, 'route'), 'route'));
        }

        // Scan portal packages
        const portalPath = path.join(srcPath, 'portal');
        if (fs.existsSync(portalPath)) {
            try {
                const packages = fs.readdirSync(portalPath, { withFileTypes: true });
                for (const pkg of packages) {
                    if (pkg.isDirectory()) {
                        allApps.push(...this._scanApps(
                            path.join(portalPath, pkg.name, 'app'), `portal/${pkg.name}`
                        ));
                        if (typesToScan.includes('route') || appType === 'all') {
                            allApps.push(...this._scanApps(
                                path.join(portalPath, pkg.name, 'route'), `portal/${pkg.name}/route`
                            ));
                        }
                    }
                }
            } catch (e) { /* skip */ }
        }

        return this._jsonResult({ apps: allApps, count: allApps.length });
    }

    async getAppInfo({ appPath }) {
        const appJsonPath = path.join(appPath, 'app.json');
        if (!fs.existsSync(appJsonPath)) {
            throw new Error(`app.json not found at ${appPath}`);
        }

        const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
        const files = fs.readdirSync(appPath);

        // 각 파일의 크기와 존재 여부
        const fileDetails = files.map(f => {
            const fp = path.join(appPath, f);
            const stat = fs.statSync(fp);
            return {
                name: f,
                size: stat.size,
                isDirectory: stat.isDirectory()
            };
        });

        return this._jsonResult({
            ...appJson,
            path: appPath,
            files: fileDetails
        });
    }

    async createApp({ workspacePath, projectName, appType, namespace, title, category, controller, layout, viewuri }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const parentPath = this._getAppParentPath(srcPath);

        const appID = `${appType}.${namespace}`;
        const newAppPath = path.join(parentPath, appID);

        if (fs.existsSync(newAppPath)) {
            throw new Error(`App '${appID}' already exists at ${newAppPath}`);
        }

        fs.mkdirSync(newAppPath, { recursive: true });

        const appJson = {
            id: appID,
            mode: appType,
            title: title || namespace,
            namespace: namespace,
            category: category || namespace,
            viewuri: viewuri || '',
            preview: '',
            controller: controller || '',
            layout: layout || ''
        };

        fs.writeFileSync(path.join(newAppPath, 'app.json'), JSON.stringify(appJson, null, 4));
        fs.writeFileSync(path.join(newAppPath, 'view.html'), APP_TEMPLATES['view.html']);
        fs.writeFileSync(path.join(newAppPath, 'view.ts'), APP_TEMPLATES['view.ts']);

        return this._jsonResult({ success: true, appPath: newAppPath, appJson });
    }

    async createRoute({ workspacePath, projectName, id, title, routePath }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const routeDir = path.join(srcPath, 'route');

        if (!fs.existsSync(routeDir)) {
            fs.mkdirSync(routeDir, { recursive: true });
        }

        const newRoutePath = path.join(routeDir, id);

        if (fs.existsSync(newRoutePath)) {
            throw new Error(`Route '${id}' already exists`);
        }

        fs.mkdirSync(newRoutePath, { recursive: true });

        const appJson = {
            id: id,
            title: title || id,
            route: routePath || '',
            category: '',
            viewuri: '',
            controller: ''
        };

        fs.writeFileSync(path.join(newRoutePath, 'app.json'), JSON.stringify(appJson, null, 4));
        fs.writeFileSync(path.join(newRoutePath, 'controller.py'), '');

        return this._jsonResult({ success: true, routePath: newRoutePath, appJson });
    }

    async createPortalApp({ workspacePath, projectName, packageName, namespace, title, category, controller }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const appFolderPath = path.join(srcPath, 'portal', packageName, 'app');

        if (!fs.existsSync(path.join(srcPath, 'portal', packageName))) {
            throw new Error(`Package '${packageName}' does not exist`);
        }

        if (!fs.existsSync(appFolderPath)) {
            fs.mkdirSync(appFolderPath, { recursive: true });
        }

        const newAppPath = path.join(appFolderPath, namespace);

        if (fs.existsSync(newAppPath)) {
            throw new Error(`Portal app '${namespace}' already exists in package '${packageName}'`);
        }

        fs.mkdirSync(newAppPath, { recursive: true });

        const appJson = {
            id: namespace,
            mode: 'portal',
            title: title || namespace,
            namespace: namespace,
            category: category || 'editor',
            viewuri: '',
            controller: controller || '',
            template: `wiz-portal-${packageName}-${namespace.replace(/\./g, '-')}`
        };

        fs.writeFileSync(path.join(newAppPath, 'app.json'), JSON.stringify(appJson, null, 4));
        fs.writeFileSync(path.join(newAppPath, 'view.html'), APP_TEMPLATES['view.html']);
        fs.writeFileSync(path.join(newAppPath, 'view.ts'), APP_TEMPLATES['view.ts']);
        fs.writeFileSync(path.join(newAppPath, 'view.scss'), APP_TEMPLATES['view.scss']);

        return this._jsonResult({ success: true, appPath: newAppPath, appJson });
    }

    async createPortalRoute({ workspacePath, projectName, packageName, id, title, routePath }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const routeFolderPath = path.join(srcPath, 'portal', packageName, 'route');

        if (!fs.existsSync(path.join(srcPath, 'portal', packageName))) {
            throw new Error(`Package '${packageName}' does not exist`);
        }

        if (!fs.existsSync(routeFolderPath)) {
            fs.mkdirSync(routeFolderPath, { recursive: true });
        }

        const newRoutePath = path.join(routeFolderPath, id);

        if (fs.existsSync(newRoutePath)) {
            throw new Error(`Portal route '${id}' already exists in package '${packageName}'`);
        }

        fs.mkdirSync(newRoutePath, { recursive: true });

        const appJson = {
            id: id,
            title: title || id,
            route: routePath || '',
            category: '',
            viewuri: '',
            controller: ''
        };

        fs.writeFileSync(path.join(newRoutePath, 'app.json'), JSON.stringify(appJson, null, 4));
        fs.writeFileSync(path.join(newRoutePath, 'controller.py'), '');

        return this._jsonResult({ success: true, routePath: newRoutePath, appJson });
    }

    async updateApp({ appPath, updates }) {
        const appJsonPath = path.join(appPath, 'app.json');
        if (!fs.existsSync(appJsonPath)) {
            throw new Error(`app.json not found at ${appPath}`);
        }

        const currentData = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
        const newData = { ...currentData, ...updates };

        fs.writeFileSync(appJsonPath, JSON.stringify(newData, null, 4));

        return this._jsonResult({ success: true, appJson: newData });
    }

    async deleteApp({ appPath }) {
        if (!fs.existsSync(appPath)) {
            throw new Error(`App folder not found: ${appPath}`);
        }

        fs.rmSync(appPath, { recursive: true, force: true });

        return this._jsonResult({ success: true, deletedPath: appPath });
    }

    async searchApps({ workspacePath, projectName, query }) {
        // 전체 앱 목록 조회 후 필터링
        const result = await this.listApps({ workspacePath, projectName, appType: 'all' });
        const allApps = JSON.parse(result.content[0].text).apps;

        const q = query.toLowerCase();
        const matched = allApps.filter(app => {
            const searchFields = [
                app.name, app.title, app.namespace, app.id, app.category, app.mode
            ].filter(Boolean).map(s => s.toLowerCase());
            return searchFields.some(field => field.includes(q));
        });

        return this._jsonResult({ query, results: matched, count: matched.length });
    }

    // ==================== Package Management ====================

    async listPackages({ workspacePath, projectName }) {
        const portalPath = path.join(workspacePath, 'project', projectName, 'src', 'portal');

        if (!fs.existsSync(portalPath)) {
            return this._jsonResult({ packages: [] });
        }

        const packages = fs.readdirSync(portalPath, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => {
                const portalJsonPath = path.join(portalPath, entry.name, 'portal.json');
                let info = { name: entry.name, path: path.join(portalPath, entry.name) };
                if (fs.existsSync(portalJsonPath)) {
                    try {
                        info = { ...info, ...JSON.parse(fs.readFileSync(portalJsonPath, 'utf8')) };
                    } catch (e) { /* skip */ }
                }
                // 하위 폴더 목록
                const subFolders = [];
                try {
                    const entries = fs.readdirSync(path.join(portalPath, entry.name), { withFileTypes: true });
                    for (const e of entries) {
                        if (e.isDirectory()) subFolders.push(e.name);
                    }
                } catch (e) { /* skip */ }
                info.subFolders = subFolders;
                return info;
            });

        return this._jsonResult({ packages });
    }

    async createPackage({ workspacePath, projectName, namespace, title }) {
        const command = `wiz project package create --namespace=${namespace} --project=${projectName}${title ? ` --title=${title}` : ''}`;

        const { stdout, stderr } = await exec(command, { cwd: workspacePath });

        return this._jsonResult({ success: true, output: stdout, errors: stderr || null, namespace });
    }

    async exportPackage({ workspacePath, projectName, packageName }) {
        const packagePath = path.join(workspacePath, 'project', projectName, 'src', 'portal', packageName);

        if (!fs.existsSync(packagePath)) {
            throw new Error(`Package '${packageName}' not found`);
        }

        const exportsDir = path.join(workspacePath, 'exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const outputPath = path.join(exportsDir, `${packageName}.wizpkg`);

        await exec(`cd "${packagePath}" && zip -r "${outputPath}" .`);

        return this._jsonResult({ success: true, outputPath });
    }

    // ==================== Dependency Management (pip / npm) ====================

    /**
     * pip 실행 경로 결정 (venv 우선, 폴백으로 시스템 pip)
     */
    _getPipPath(workspacePath) {
        const venvPaths = [
            path.join(workspacePath, 'venv', 'bin', 'pip'),
            path.join(workspacePath, '.venv', 'bin', 'pip'),
            path.join(workspacePath, 'env', 'bin', 'pip'),
        ];
        for (const p of venvPaths) {
            if (fs.existsSync(p)) return p;
        }
        // pip3 우선, 없으면 pip
        return 'pip3';
    }

    /**
     * npm 실행 디렉토리 결정
     */
    _getNpmCwd(workspacePath, projectName, global) {
        if (global) return workspacePath;
        const projectPath = path.join(workspacePath, 'project', projectName);
        // package.json이 프로젝트 디렉토리에 있으면 그곳, 아니면 workspace root
        if (fs.existsSync(path.join(projectPath, 'package.json'))) {
            return projectPath;
        }
        return workspacePath;
    }

    async pipList({ workspacePath, outdated = false }) {
        const pip = this._getPipPath(workspacePath);
        const args = outdated ? 'list --outdated --format=json' : 'list --format=json';

        try {
            const { stdout } = await exec(`${pip} ${args}`, { cwd: workspacePath });
            const packages = JSON.parse(stdout);
            return this._jsonResult({
                packages,
                count: packages.length,
                pip,
                outdated
            });
        } catch (error) {
            throw new Error(`pip list failed: ${error.message}`);
        }
    }

    async pipInstall({ workspacePath, packages, upgrade = false }) {
        if (!packages || packages.length === 0) {
            throw new Error('No packages specified');
        }

        const pip = this._getPipPath(workspacePath);
        const upgradeFlag = upgrade ? ' --upgrade' : '';
        const pkgStr = packages.map(p => `"${p}"`).join(' ');

        try {
            const { stdout, stderr } = await exec(
                `${pip} install${upgradeFlag} ${pkgStr}`,
                { cwd: workspacePath }
            );
            return this._jsonResult({
                success: true,
                packages,
                output: stdout,
                warnings: stderr || null
            });
        } catch (error) {
            throw new Error(`pip install failed: ${error.message}`);
        }
    }

    async pipUninstall({ workspacePath, packages }) {
        if (!packages || packages.length === 0) {
            throw new Error('No packages specified');
        }

        const pip = this._getPipPath(workspacePath);
        const pkgStr = packages.map(p => `"${p}"`).join(' ');

        try {
            const { stdout, stderr } = await exec(
                `${pip} uninstall -y ${pkgStr}`,
                { cwd: workspacePath }
            );
            return this._jsonResult({
                success: true,
                packages,
                output: stdout,
                warnings: stderr || null
            });
        } catch (error) {
            throw new Error(`pip uninstall failed: ${error.message}`);
        }
    }

    async npmList({ workspacePath, projectName, global = false, outdated = false }) {
        const cwd = this._getNpmCwd(workspacePath, projectName, global);

        try {
            if (outdated) {
                // npm outdated는 outdated 패키지가 있으면 exit code 1을 반환
                try {
                    const { stdout } = await exec('npm outdated --json', { cwd });
                    const packages = JSON.parse(stdout || '{}');
                    return this._jsonResult({ packages, cwd, outdated: true });
                } catch (e) {
                    // npm outdated는 패키지가 있으면 exit code 1 반환 (정상 동작)
                    if (e.stdout) {
                        const packages = JSON.parse(e.stdout || '{}');
                        return this._jsonResult({ packages, cwd, outdated: true });
                    }
                    throw e;
                }
            } else {
                const { stdout } = await exec('npm list --json --depth=0', { cwd });
                const result = JSON.parse(stdout);
                const dependencies = result.dependencies || {};
                const packages = Object.entries(dependencies).map(([name, info]) => ({
                    name,
                    version: info.version || 'unknown'
                }));
                return this._jsonResult({ packages, count: packages.length, cwd });
            }
        } catch (error) {
            throw new Error(`npm list failed: ${error.message}`);
        }
    }

    async npmInstall({ workspacePath, projectName, packages, dev = false, global = false }) {
        if (!packages || packages.length === 0) {
            throw new Error('No packages specified');
        }

        const cwd = this._getNpmCwd(workspacePath, projectName, global);
        const devFlag = dev ? ' --save-dev' : '';
        const pkgStr = packages.map(p => `"${p}"`).join(' ');

        // package.json이 없으면 초기화
        const pkgJsonPath = path.join(cwd, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) {
            await exec('npm init -y', { cwd });
        }

        try {
            const { stdout, stderr } = await exec(
                `npm install${devFlag} ${pkgStr}`,
                { cwd }
            );
            return this._jsonResult({
                success: true,
                packages,
                dev,
                output: stdout,
                warnings: stderr || null,
                cwd
            });
        } catch (error) {
            throw new Error(`npm install failed: ${error.message}`);
        }
    }

    async npmUninstall({ workspacePath, projectName, packages, global = false }) {
        if (!packages || packages.length === 0) {
            throw new Error('No packages specified');
        }

        const cwd = this._getNpmCwd(workspacePath, projectName, global);
        const pkgStr = packages.map(p => `"${p}"`).join(' ');

        try {
            const { stdout, stderr } = await exec(
                `npm uninstall ${pkgStr}`,
                { cwd }
            );
            return this._jsonResult({
                success: true,
                packages,
                output: stdout,
                warnings: stderr || null,
                cwd
            });
        } catch (error) {
            throw new Error(`npm uninstall failed: ${error.message}`);
        }
    }

    // ==================== File System Operations ====================

    async getProjectStructure({ workspacePath, projectName, maxDepth = 4, subPath }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const startPath = subPath ? path.join(srcPath, subPath) : srcPath;

        if (!fs.existsSync(startPath)) {
            throw new Error(`Path does not exist: ${startPath}`);
        }

        const tree = this._buildTree(startPath, { maxDepth, includeFiles: true });

        return this._jsonResult({
            basePath: startPath,
            tree
        });
    }

    async listDirectory({ dirPath }) {
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Directory does not exist: ${dirPath}`);
        }

        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) {
            throw new Error(`Path is not a directory: ${dirPath}`);
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const items = entries.map(entry => {
            const fullPath = path.join(dirPath, entry.name);
            const entryStat = fs.statSync(fullPath);
            return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: entryStat.size,
                modified: entryStat.mtime.toISOString()
            };
        });

        return this._jsonResult({ path: dirPath, items, count: items.length });
    }

    async readFile({ filePath, startLine, endLine }) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist: ${filePath}`);
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            throw new Error(`Path is a directory, not a file: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf8');

        if (startLine || endLine) {
            const lines = content.split('\n');
            const start = (startLine || 1) - 1;
            const end = endLine || lines.length;
            const sliced = lines.slice(start, end);
            return this._jsonResult({
                filePath,
                content: sliced.join('\n'),
                totalLines: lines.length,
                range: { start: start + 1, end: Math.min(end, lines.length) }
            });
        }

        return this._jsonResult({
            filePath,
            content,
            size: stat.size,
            totalLines: content.split('\n').length
        });
    }

    async writeFile({ filePath, content }) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content, 'utf8');

        return this._jsonResult({ success: true, filePath, size: Buffer.byteLength(content, 'utf8') });
    }

    async createFolder({ folderPath }) {
        if (fs.existsSync(folderPath)) {
            throw new Error(`Path already exists: ${folderPath}`);
        }

        fs.mkdirSync(folderPath, { recursive: true });

        return this._jsonResult({ success: true, folderPath });
    }

    async deleteFile({ targetPath }) {
        if (!fs.existsSync(targetPath)) {
            throw new Error(`Path does not exist: ${targetPath}`);
        }

        const stat = fs.statSync(targetPath);
        fs.rmSync(targetPath, { recursive: true, force: true });

        return this._jsonResult({
            success: true,
            deletedPath: targetPath,
            wasDirectory: stat.isDirectory()
        });
    }

    async renameFile({ oldPath, newPath }) {
        if (!fs.existsSync(oldPath)) {
            throw new Error(`Source path does not exist: ${oldPath}`);
        }

        if (fs.existsSync(newPath)) {
            throw new Error(`Destination path already exists: ${newPath}`);
        }

        // 대상 디렉토리가 없으면 생성
        const destDir = path.dirname(newPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.renameSync(oldPath, newPath);

        return this._jsonResult({ success: true, oldPath, newPath });
    }

    // ==================== App File Shortcuts ====================

    async readAppFile({ appPath, fileName }) {
        const filePath = path.join(appPath, fileName);

        if (!fs.existsSync(filePath)) {
            return this._jsonResult({ exists: false, content: null, fileName });
        }

        const content = fs.readFileSync(filePath, 'utf8');

        return this._jsonResult({ exists: true, content, fileName, filePath });
    }

    async writeAppFile({ appPath, fileName, content }) {
        const filePath = path.join(appPath, fileName);

        // 앱 폴더가 없으면 에러
        if (!fs.existsSync(appPath)) {
            throw new Error(`App folder does not exist: ${appPath}`);
        }

        fs.writeFileSync(filePath, content, 'utf8');

        return this._jsonResult({ success: true, filePath });
    }

    // ==================== Development Helpers ====================

    async listControllers({ workspacePath, projectName, packageName }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        let controllerDir;

        if (packageName) {
            controllerDir = path.join(srcPath, 'portal', packageName, 'controller');
        } else {
            controllerDir = path.join(srcPath, 'controller');
        }

        if (!fs.existsSync(controllerDir)) {
            return this._jsonResult({ controllers: [], controllerDir });
        }

        const controllers = fs.readdirSync(controllerDir)
            .filter(file => file.endsWith('.py') && file !== '__init__.py')
            .map(file => {
                const name = file.replace('.py', '');
                const filePath = path.join(controllerDir, file);
                const stat = fs.statSync(filePath);
                return { name, file, path: filePath, size: stat.size };
            });

        return this._jsonResult({ controllers, controllerDir });
    }

    async listLayouts({ workspacePath, projectName }) {
        const srcPath = this._getSrcPath(workspacePath, projectName);
        const layouts = [];

        // src/app/ 에서 layout.* 폴더 검색
        const appDir = path.join(srcPath, 'app');
        if (fs.existsSync(appDir)) {
            try {
                const entries = fs.readdirSync(appDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && entry.name.startsWith('layout.')) {
                        const appJsonPath = path.join(appDir, entry.name, 'app.json');
                        let info = { name: entry.name, path: path.join(appDir, entry.name) };
                        if (fs.existsSync(appJsonPath)) {
                            try {
                                const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                                info = { ...info, ...appJson };
                            } catch (e) { /* skip */ }
                        }
                        layouts.push(info);
                    }
                }
            } catch (e) { /* skip */ }
        }

        // src/layout/ 에서도 검색
        const layoutDir = path.join(srcPath, 'layout');
        if (fs.existsSync(layoutDir)) {
            try {
                const entries = fs.readdirSync(layoutDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const appJsonPath = path.join(layoutDir, entry.name, 'app.json');
                        let info = { name: entry.name, path: path.join(layoutDir, entry.name) };
                        if (fs.existsSync(appJsonPath)) {
                            try {
                                const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                                info = { ...info, ...appJson };
                            } catch (e) { /* skip */ }
                        }
                        layouts.push(info);
                    }
                }
            } catch (e) { /* skip */ }
        }

        return this._jsonResult({ layouts });
    }

    // ==================== Server ====================

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Wiz MCP Server running on stdio');
    }
}

// Start server
const server = new WizMcpServer();
server.run().catch(console.error);

module.exports = WizMcpServer;
