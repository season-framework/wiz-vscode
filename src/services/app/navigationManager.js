/**
 * NavigationManager - 앱 탐색 및 네비게이션 관리
 * 앱 검색, 위치 선택, 템플릿 복사, 파일 전환 등
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { WizPathUtils, WizFileUtils, WizUriFactory } = require('../../core');

class NavigationManager {
    /**
     * @param {Object} options
     * @param {Function} options.getWorkspaceRoot - 워크스페이스 루트 반환 함수
     * @param {Function} options.openInfoEditor - Info 에디터 열기 콜백
     * @param {Function} options.getActiveEditor - 활성 에디터 정보 반환 콜백
     * @param {Function} options.closeWebview - Webview 닫기 콜백
     */
    constructor(options = {}) {
        this.getWorkspaceRoot = options.getWorkspaceRoot || (() => undefined);
        this.openInfoEditor = options.openInfoEditor || (() => {});
        this.getActiveEditor = options.getActiveEditor || (() => null);
        this.closeWebview = options.closeWebview || (() => {});
    }

    /**
     * 앱 아이콘 반환
     * @private
     */
    _getAppIcon(mode) {
        const icons = {
            'page': 'browser',
            'component': 'symbol-class',
            'widget': 'symbol-snippet',
            'layout': 'layout',
            'route': 'circuit-board',
            'portal': 'package'
        };
        return icons[mode] || 'file-code';
    }

    /**
     * 디렉토리에서 앱 스캔
     * @private
     */
    _scanApps(dirPath, category, apps) {
        if (!fs.existsSync(dirPath)) return;

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const appJsonPath = path.join(dirPath, entry.name, 'app.json');
                    if (fs.existsSync(appJsonPath)) {
                        try {
                            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
                            apps.push({
                                label: `$(${this._getAppIcon(appJson.mode || category)}) ${appJson.title || entry.name}`,
                                description: appJson.id || entry.name,
                                detail: category,
                                appPath: path.join(dirPath, entry.name),
                                mode: appJson.mode || category
                            });
                        } catch (e) { /* skip invalid json */ }
                    }
                }
            }
        } catch (e) { /* skip inaccessible dirs */ }
    }

    /**
     * 앱 검색 및 이동 (Go to App)
     * @returns {Promise<void>}
     */
    async goToApp() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
            return;
        }

        const srcPath = path.join(workspaceRoot, 'src');
        if (!fs.existsSync(srcPath)) return;

        const apps = [];

        // Scan standard app directories
        ['page', 'component', 'widget', 'layout'].forEach(type => {
            this._scanApps(path.join(srcPath, type), type, apps);
        });

        // Scan route
        this._scanApps(path.join(srcPath, 'route'), 'route', apps);

        // Scan portal packages
        const portalPath = path.join(srcPath, 'portal');
        if (fs.existsSync(portalPath)) {
            try {
                const packages = fs.readdirSync(portalPath, { withFileTypes: true });
                for (const pkg of packages) {
                    if (pkg.isDirectory()) {
                        this._scanApps(path.join(portalPath, pkg.name, 'app'), `portal/${pkg.name}`, apps);
                        this._scanApps(path.join(portalPath, pkg.name, 'route'), `portal/${pkg.name}/route`, apps);
                    }
                }
            } catch (e) { /* skip */ }
        }

        if (apps.length === 0) {
            vscode.window.showInformationMessage('앱이 없습니다.');
            return;
        }

        const selected = await vscode.window.showQuickPick(apps, {
            placeHolder: '앱 이름으로 검색',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            this.openInfoEditor(selected.appPath);
        }
    }

    /**
     * 템플릿 값 복사
     * @param {string} appPath - 앱 경로
     * @returns {Promise<boolean>} 성공 여부
     */
    async copyTemplate(appPath) {
        if (!appPath) {
            vscode.window.showWarningMessage('현재 열린 앱 파일이 없습니다.');
            return false;
        }

        const appJsonPath = path.join(appPath, 'app.json');
        if (!fs.existsSync(appJsonPath)) {
            vscode.window.showErrorMessage('app.json 파일을 찾을 수 없습니다.');
            return false;
        }

        try {
            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
            const template = appJson.template || '';

            if (!template) {
                vscode.window.showWarningMessage('template 값이 비어있습니다.');
                return false;
            }

            await vscode.env.clipboard.writeText(template);
            vscode.window.showInformationMessage(`Template 복사됨: ${template}`);
            return true;
        } catch (e) {
            vscode.window.showErrorMessage(`Template 복사 실패: ${e.message}`);
            return false;
        }
    }

    /**
     * 앱 부모 경로 반환 (src/app 또는 src)
     * @returns {string|null}
     */
    getAppParentPath() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return null;

        const srcPath = path.join(workspaceRoot, 'src');
        const appPath = path.join(srcPath, 'app');

        // src/app 폴더가 있으면 그 안에 생성, 없으면 src에 생성
        if (fs.existsSync(appPath) && fs.statSync(appPath).isDirectory()) {
            return appPath;
        }

        // src/app 폴더가 없으면 src 폴더에 생성
        if (!fs.existsSync(srcPath)) {
            fs.mkdirSync(srcPath, { recursive: true });
        }
        return srcPath;
    }

    /**
     * 포탈 패키지 목록 반환
     * @returns {string[]}
     */
    getPortalPackages() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return [];

        const portalPath = path.join(workspaceRoot, 'src', 'portal');
        if (!fs.existsSync(portalPath)) return [];

        try {
            return fs.readdirSync(portalPath, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name);
        } catch (e) {
            return [];
        }
    }

    /**
     * 앱 생성 위치 선택 (Source 또는 Package)
     * @param {string} appType - 앱 타입 (page, component, layout)
     * @returns {Promise<{type: string, path: string}|null>}
     */
    async selectAppLocation(appType) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return null;

        const packages = this.getPortalPackages();

        const locationItems = [
            { label: '$(folder) Source', description: 'src 폴더에 생성', type: 'source' }
        ];

        if (packages.length > 0) {
            locationItems.push({ label: '$(package) Package', description: 'Portal 패키지에 생성', type: 'package' });
        }

        // 패키지가 없으면 바로 Source 선택
        if (packages.length === 0) {
            return { type: 'source', path: this.getAppParentPath() };
        }

        const locationChoice = await vscode.window.showQuickPick(locationItems, {
            title: `${appType.charAt(0).toUpperCase() + appType.slice(1)} 생성 위치 선택`,
            placeHolder: '앱을 생성할 위치를 선택하세요'
        });

        if (!locationChoice) return null;

        if (locationChoice.type === 'source') {
            return { type: 'source', path: this.getAppParentPath() };
        }

        // Package 선택
        const packageItems = packages.map(pkg => ({
            label: `$(package) ${pkg}`,
            value: pkg
        }));

        const selectedPackage = await vscode.window.showQuickPick(packageItems, {
            title: '패키지 선택',
            placeHolder: '앱을 생성할 패키지를 선택하세요'
        });

        if (!selectedPackage) return null;

        const packageAppPath = path.join(workspaceRoot, 'src', 'portal', selectedPackage.value, 'app');
        if (!fs.existsSync(packageAppPath)) {
            fs.mkdirSync(packageAppPath, { recursive: true });
        }

        return { type: 'package', path: packageAppPath };
    }

    /**
     * 라우트 생성 위치 선택 (Source 또는 Package)
     * @returns {Promise<{type: string, path: string}|null>}
     */
    async selectRouteLocation() {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return null;

        const packages = this.getPortalPackages();

        const locationItems = [
            { label: '$(folder) Source', description: 'src/route 폴더에 생성', type: 'source' }
        ];

        if (packages.length > 0) {
            locationItems.push({ label: '$(package) Package', description: 'Portal 패키지에 생성', type: 'package' });
        }

        // 패키지가 없으면 바로 Source 선택
        if (packages.length === 0) {
            const routePath = path.join(workspaceRoot, 'src', 'route');
            if (!fs.existsSync(routePath)) {
                fs.mkdirSync(routePath, { recursive: true });
            }
            return { type: 'source', path: routePath };
        }

        const locationChoice = await vscode.window.showQuickPick(locationItems, {
            title: 'Route 생성 위치 선택',
            placeHolder: '라우트를 생성할 위치를 선택하세요'
        });

        if (!locationChoice) return null;

        if (locationChoice.type === 'source') {
            const routePath = path.join(workspaceRoot, 'src', 'route');
            if (!fs.existsSync(routePath)) {
                fs.mkdirSync(routePath, { recursive: true });
            }
            return { type: 'source', path: routePath };
        }

        // Package 선택
        const packageItems = packages.map(pkg => ({
            label: `$(package) ${pkg}`,
            value: pkg
        }));

        const selectedPackage = await vscode.window.showQuickPick(packageItems, {
            title: '패키지 선택',
            placeHolder: '라우트를 생성할 패키지를 선택하세요'
        });

        if (!selectedPackage) return null;

        const packageRoutePath = path.join(workspaceRoot, 'src', 'portal', selectedPackage.value, 'route');
        if (!fs.existsSync(packageRoutePath)) {
            fs.mkdirSync(packageRoutePath, { recursive: true });
        }

        return { type: 'package', path: packageRoutePath };
    }

    /**
     * 현재 앱 경로 해석
     * @returns {string|null} 앱 디렉토리 경로
     */
    resolveCurrentAppPath() {
        const editor = vscode.window.activeTextEditor;

        if (editor) {
            const uri = editor.document.uri;
            if (uri.scheme === 'wiz') {
                const realPath = WizPathUtils.getRealPathFromUri(uri);
                return realPath ? path.dirname(realPath) : null;
            } else if (uri.scheme === 'file') {
                return path.dirname(uri.fsPath);
            }
        }

        // Webview가 활성화된 경우
        const activeEditor = this.getActiveEditor();
        if (activeEditor && activeEditor.panel && activeEditor.panel.active) {
            return activeEditor.appPath;
        }

        return null;
    }

    /**
     * 파일 타입 전환
     * @param {string} type - 파일 타입 (info, controller, ui, component, scss, api, socket)
     * @returns {Promise<void>}
     */
    async switchFile(type) {
        const dirPath = this.resolveCurrentAppPath();
        if (!dirPath) return;

        // INFO 탭은 Webview로 처리
        if (type === 'info') {
            this.openInfoEditor(dirPath);
            return;
        }

        const files = WizFileUtils.readAppFiles(dirPath);
        const target = files[type];
        
        if (!target) {
            vscode.window.setStatusBarMessage(`Invalid file type: ${type}`, 3000);
            return;
        }

        // 파일이 없으면 생성
        if (!target.exists) {
            if (!WizFileUtils.safeWriteFile(target.fullPath, '')) {
                vscode.window.showErrorMessage(`파일 생성 실패`);
                return;
            }
        }

        const wizUri = WizUriFactory.fromAppPath(dirPath, target.fullPath, target.label);
        const doc = await vscode.workspace.openTextDocument(wizUri);
        
        const language = WizFileUtils.getLanguageFromExtension(target.fullPath);
        if (language) {
            vscode.languages.setTextDocumentLanguage(doc, language);
        }

        this.closeWebview();
        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
    }

    _detectActiveFileType() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) {
            const activeEditor = this.getActiveEditor();
            if (activeEditor && activeEditor.panel && activeEditor.panel.active) {
                return 'info';
            }
            return null;
        }

        const uri = editor.document.uri;
        if (uri.scheme === 'wiz') {
            const query = new URLSearchParams(uri.query || '');
            const label = query.get('label');
            if (label) {
                return WizFileUtils.getTypeFromVirtualPath(label);
            }

            const realPath = WizPathUtils.getRealPathFromUri(uri);
            if (realPath) {
                return WizFileUtils.getTypeFromFileName(path.basename(realPath));
            }

            const virtualName = uri.path.split('/').pop() || '';
            return WizFileUtils.getTypeFromVirtualPath(virtualName);
        }

        if (uri.scheme === 'file') {
            return WizFileUtils.getTypeFromFileName(path.basename(uri.fsPath));
        }

        return null;
    }

    _getNavigableTypes(dirPath) {
        const files = WizFileUtils.readAppFiles(dirPath);
        const { category } = WizPathUtils.parseAppFolder(dirPath);
        const orderedTypes = category === 'route'
            ? ['controller']
            : ['ui', 'component', 'scss', 'api', 'socket'];

        return orderedTypes.filter(type => files[type] && files[type].exists);
    }

    async navigateFile(direction) {
        const dirPath = this.resolveCurrentAppPath();
        if (!dirPath) return;

        const availableTypes = this._getNavigableTypes(dirPath);
        if (availableTypes.length < 2) return;

        const currentType = this._detectActiveFileType();
        if (!currentType) return;

        const currentIndex = availableTypes.indexOf(currentType);
        if (currentIndex === -1) return;

        const step = direction === 'previous' ? -1 : 1;
        const targetIndex = (currentIndex + step + availableTypes.length) % availableTypes.length;
        await this.switchFile(availableTypes[targetIndex]);
    }

    async openCurrentInSplit() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document) return;

        await vscode.window.showTextDocument(editor.document, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true,
            preserveFocus: false
        });
    }

    /**
     * 앱 파일 메뉴 표시
     * @returns {Promise<void>}
     */
    async showAppMenu() {
        const dirPath = this.resolveCurrentAppPath();
        if (!dirPath) return;
        
        const files = WizFileUtils.readAppFiles(dirPath);
        const items = Object.entries(files)
            .filter((entry) => entry[1].exists)
            .map(([key, val]) => ({
                label: `${val.icon} ${key.toUpperCase()}`,
                description: val.fileName,
                type: key
            }));
        
        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Switch to...' });
        if (selected) {
            await this.switchFile(selected.type);
        }
    }
}

module.exports = NavigationManager;
