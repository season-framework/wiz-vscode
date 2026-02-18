/**
 * PipEditor - pip 패키지 관리 Webview 에디터
 * 현재 선택된 Python 가상환경 기준으로 패키지 목록 표시,
 * 설치/업그레이드/삭제 지원
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const EditorBase = require('./editorBase');

class PipEditor extends EditorBase {
    /**
     * @param {vscode.ExtensionContext} context
     * @param {Object} options
     * @param {string} options.pythonPath - Python 인터프리터 경로
     * @param {vscode.OutputChannel} options.outputChannel - 출력 채널
     */
    constructor(context, options = {}) {
        super(context);
        this.pythonPath = options.pythonPath;
        this.outputChannel = options.outputChannel;
        this._isRunning = false;
    }

    get envLabel() {
        if (!this.pythonPath) return 'Python';
        const dir = path.dirname(this.pythonPath);
        const parent = path.basename(path.dirname(dir));
        return parent || path.basename(dir);
    }

    async create() {
        this.createPanel('wizPipManager', 'pip 패키지 관리 [' + this.envLabel + ']');

        const codiconUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
        );
        const codiconFallbackUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'codicon.css')
        );
        this._codiconUri = codiconUri;
        this._codiconFallbackUri = codiconFallbackUri;

        this.panel.webview.onDidReceiveMessage(
            message => this._handleMessage(message)
        );

        await this._updateWebview();
    }

    async _updateWebview() {
        const packages = await this._listPackages();
        this.panel.webview.html = this._generateHtml(packages);
    }

    /**
     * pip list --format=json 으로 설치된 패키지 목록 조회
     */
    async _listPackages() {
        if (!this.pythonPath || !fs.existsSync(this.pythonPath)) {
            return [];
        }
        const result = await this._execPip(['list', '--format=json']);
        if (result.code !== 0) return [];
        try {
            return JSON.parse(result.stdout.trim());
        } catch {
            return [];
        }
    }

    /**
     * pip 명령 실행 (python -m pip)
     */
    _execPip(args) {
        return new Promise((resolve) => {
            const fullArgs = ['-m', 'pip', ...args];
            this._log('실행: ' + this.pythonPath + ' ' + fullArgs.join(' '));

            const proc = cp.spawn(this.pythonPath, fullArgs, {
                shell: false,
                env: { ...process.env }
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                this._log(text.trimEnd());
            });

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                this._log(text.trimEnd());
            });

            proc.on('close', (code) => {
                resolve({ code, stdout, stderr });
            });

            proc.on('error', (err) => {
                resolve({ code: 1, stdout, stderr: err.message });
            });
        });
    }

    _log(message) {
        if (this.outputChannel) {
            this.outputChannel.appendLine('[pip] ' + message);
        }
    }

    async _handleMessage(message) {
        if (this._isRunning) {
            this.postMessage({ command: 'error', text: '이전 작업이 진행 중입니다. 잠시 후 다시 시도하세요.' });
            return;
        }

        switch (message.command) {
            case 'install':
                await this._installPackage(message.packageName);
                break;
            case 'uninstall':
                await this._uninstallPackage(message.packageName);
                break;
            case 'upgrade':
                await this._upgradePackage(message.packageName);
                break;
            case 'upgradeAll':
                await this._upgradeAllPackages();
                break;
            case 'refresh':
                await this._updateWebview();
                break;
            case 'getOutdated':
                await this._getOutdated();
                break;
        }
    }

    async _installPackage(packageName) {
        if (!packageName || !packageName.trim()) {
            this.postMessage({ command: 'error', text: '패키지 이름을 입력하세요.' });
            return;
        }

        this._isRunning = true;
        this.postMessage({ command: 'loading', text: packageName + ' 설치 중...' });
        if (this.outputChannel) this.outputChannel.show(true);

        const result = await this._execPip(['install', packageName.trim()]);
        this._isRunning = false;

        if (result.code === 0) {
            this.postMessage({ command: 'success', text: packageName + ' 설치 완료' });
            await this._updateWebview();
        } else {
            this.postMessage({ command: 'error', text: packageName + ' 설치 실패' });
        }
    }

    async _uninstallPackage(packageName) {
        this._isRunning = true;
        this.postMessage({ command: 'loading', text: packageName + ' 삭제 중...' });
        if (this.outputChannel) this.outputChannel.show(true);

        const result = await this._execPip(['uninstall', '-y', packageName]);
        this._isRunning = false;

        if (result.code === 0) {
            this.postMessage({ command: 'success', text: packageName + ' 삭제 완료' });
            await this._updateWebview();
        } else {
            this.postMessage({ command: 'error', text: packageName + ' 삭제 실패' });
        }
    }

    async _upgradePackage(packageName) {
        this._isRunning = true;
        this.postMessage({ command: 'loading', text: packageName + ' 업그레이드 중...' });
        if (this.outputChannel) this.outputChannel.show(true);

        const result = await this._execPip(['install', '--upgrade', packageName]);
        this._isRunning = false;

        if (result.code === 0) {
            this.postMessage({ command: 'success', text: packageName + ' 업그레이드 완료' });
            await this._updateWebview();
        } else {
            this.postMessage({ command: 'error', text: packageName + ' 업그레이드 실패' });
        }
    }

    async _upgradeAllPackages() {
        this._isRunning = true;
        this.postMessage({ command: 'loading', text: '업그레이드 가능한 패키지 확인 중...' });
        if (this.outputChannel) this.outputChannel.show(true);

        // outdated 목록 조회 후 일괄 업그레이드
        const outdatedResult = await this._execPip(['list', '--outdated', '--format=json']);
        let outdated = [];
        try {
            if (outdatedResult.stdout.trim()) {
                outdated = JSON.parse(outdatedResult.stdout.trim());
            }
        } catch { /* ignore */ }

        if (outdated.length === 0) {
            this._isRunning = false;
            this.postMessage({ command: 'success', text: '모든 패키지가 최신 상태입니다.' });
            return;
        }

        const names = outdated.map(p => p.name);
        this.postMessage({ command: 'loading', text: names.length + '개 패키지 업그레이드 중...' });

        const result = await this._execPip(['install', '--upgrade', ...names]);
        this._isRunning = false;

        if (result.code === 0) {
            this.postMessage({ command: 'success', text: names.length + '개 패키지 업그레이드 완료' });
            await this._updateWebview();
        } else {
            this.postMessage({ command: 'error', text: '패키지 업그레이드 실패' });
        }
    }

    async _getOutdated() {
        this.postMessage({ command: 'loading', text: '업데이트 확인 중...' });

        const result = await this._execPip(['list', '--outdated', '--format=json']);
        let outdated = [];
        try {
            if (result.stdout.trim()) {
                outdated = JSON.parse(result.stdout.trim());
            }
        } catch { /* ignore */ }

        // { name: "xxx", version: "1.0", latest_version: "2.0" } 형태를 맵으로 변환
        const outdatedMap = {};
        for (const pkg of outdated) {
            outdatedMap[pkg.name] = pkg.latest_version || '';
        }

        this.postMessage({ command: 'outdatedResult', data: outdatedMap });
    }

    _generateHtml(packages) {
        const hasPython = this.pythonPath && fs.existsSync(this.pythonPath);

        const renderRow = (name, version) => {
            const safeName = name.replace(/'/g, "\\'");
            return '<tr data-name="' + name + '">'
                + '<td class="pkg-name">' + name + '</td>'
                + '<td class="pkg-version">' + version + '</td>'
                + '<td class="pkg-latest"><span class="latest-placeholder">\u2014</span></td>'
                + '<td class="pkg-actions">'
                + '<button class="btn-icon btn-upgrade" title="\uC5C5\uADF8\uB808\uC774\uB4DC" onclick="upgradePackage(\'' + safeName + '\')"><i class="codicon codicon-arrow-up"></i></button>'
                + '<button class="btn-icon btn-delete" title="\uC0AD\uC81C" onclick="uninstallPackage(\'' + safeName + '\')"><i class="codicon codicon-trash"></i></button>'
                + '</td></tr>';
        };

        const rows = packages.map(p => renderRow(p.name, p.version)).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="${this._codiconUri}" onerror="this.href='${this._codiconFallbackUri}'">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 32px 24px; margin: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex; justify-content: center;
        }
        .wrapper { width: 100%; max-width: 860px; }

        .header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 6px;
        }
        h2 {
            margin: 0; font-weight: 700; font-size: 20px;
            display: flex; align-items: center; gap: 8px;
        }
        h2 .codicon { font-size: 20px; opacity: 0.7; }
        .path-info {
            font-size: 11px; opacity: 0.45; margin-bottom: 20px;
            font-family: monospace;
        }
        .toolbar { display: flex; gap: 4px; }

        .search-bar { margin-bottom: 24px; }
        .input-wrapper {
            position: relative; display: flex; align-items: center;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            border-radius: 6px; transition: border-color 0.15s; overflow: hidden;
        }
        .input-wrapper:focus-within { border-color: var(--vscode-focusBorder); }
        .input-wrapper .input-icon {
            padding: 0 0 0 12px; opacity: 0.35; font-size: 15px;
            display: flex; align-items: center; flex-shrink: 0;
        }
        .input-wrapper input[type="text"] {
            flex: 1; padding: 10px 10px; border: none; background: transparent;
            color: var(--vscode-input-foreground); outline: none; font-size: 13px; min-width: 0;
        }
        .input-wrapper .input-actions {
            display: flex; align-items: center; gap: 8px;
            padding: 0 8px 0 0; flex-shrink: 0;
        }
        .filter-hint {
            font-size: 11px; opacity: 0.4; margin-top: 6px;
            padding-left: 2px; display: none;
        }
        .filter-hint.visible { display: block; }

        .card {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
            border-radius: 8px; margin-bottom: 16px; overflow: hidden;
        }
        .card.hidden { display: none; }
        .card-header {
            display: flex; align-items: center; gap: 8px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
            background: var(--vscode-sideBar-background, transparent);
        }
        .card-title {
            font-weight: 600; font-size: 13px;
            font-family: "SF Mono", Monaco, Menlo, Consolas, monospace;
        }
        .card-body { padding: 0; }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th {
            text-align: left; padding: 8px 16px;
            font-weight: 600; font-size: 11px; opacity: 0.5;
            text-transform: uppercase; letter-spacing: 0.5px;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
        }
        td {
            padding: 7px 16px;
            border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
        }
        tr:last-child td { border-bottom: none; }
        tbody tr:hover { background: var(--vscode-list-hoverBackground); }
        tr.filtered { display: none; }
        .pkg-name { font-weight: 500; }
        .pkg-version { font-family: "SF Mono", Monaco, Menlo, Consolas, monospace; opacity: 0.75; font-size: 12px; }
        .pkg-latest { font-family: "SF Mono", Monaco, Menlo, Consolas, monospace; font-size: 12px; }
        .pkg-latest .outdated { color: #e8a838; font-weight: 500; }
        .pkg-latest .up-to-date { color: #4caf50; opacity: 0.6; }
        .pkg-latest .latest-placeholder { opacity: 0.2; }
        .pkg-actions { white-space: nowrap; text-align: right; }

        button {
            cursor: pointer; border: none; background: none;
            font-family: inherit;
            display: inline-flex; align-items: center; justify-content: center;
            gap: 5px; vertical-align: middle; line-height: 1;
        }
        button .codicon { font-size: 14px; line-height: 1; vertical-align: middle; }
        .btn-primary {
            padding: 7px 16px; border-radius: 6px;
            font-weight: 600; font-size: 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            transition: background 0.15s;
        }
        .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
        .btn-toolbar {
            padding: 5px 10px; border-radius: 5px;
            color: var(--vscode-editor-foreground); opacity: 0.55;
            font-size: 12px; transition: all 0.12s; gap: 4px;
        }
        .btn-toolbar:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
        .btn-icon {
            padding: 4px 5px; border-radius: 4px;
            color: var(--vscode-editor-foreground); opacity: 0.45;
            font-size: 14px; transition: all 0.12s;
        }
        .btn-icon:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground); }
        .btn-delete:hover { color: #f14c4c; }
        .btn-upgrade:hover { color: #4daafc; }

        .badge {
            font-size: 11px; font-weight: 500;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 8px; border-radius: 10px; line-height: 1;
        }

        .status-bar {
            margin-top: 16px; padding: 10px 14px;
            border-radius: 6px; font-size: 12px;
            display: none; align-items: center; gap: 6px;
        }
        .status-bar.loading {
            display: flex; background: rgba(77,170,252,0.08);
            color: #4daafc; border: 1px solid rgba(77,170,252,0.15);
        }
        .status-bar.success {
            display: flex; background: rgba(76,175,80,0.08);
            color: #4caf50; border: 1px solid rgba(76,175,80,0.15);
        }
        .status-bar.error {
            display: flex; background: rgba(241,76,76,0.08);
            color: #f14c4c; border: 1px solid rgba(241,76,76,0.15);
        }

        .empty-state { text-align: center; padding: 48px 20px; opacity: 0.45; }
        .empty-state p { margin: 4px 0; }
        .no-python { text-align: center; padding: 60px 20px; }
        .no-python .codicon { font-size: 32px; opacity: 0.3; margin-bottom: 12px; }
        .no-python p { margin: 4px 0; opacity: 0.5; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="header">
        <h2><i class="codicon codicon-symbol-method"></i> pip 패키지 관리</h2>
        <div class="toolbar">
            <button class="btn-toolbar" onclick="checkOutdated()" title="업데이트 확인"><i class="codicon codicon-search"></i> 업데이트 확인</button>
            <button class="btn-toolbar" onclick="upgradeAll()" title="전체 업그레이드"><i class="codicon codicon-arrow-up"></i> 전체 업그레이드</button>
            <button class="btn-toolbar" onclick="refresh()" title="새로고침"><i class="codicon codicon-refresh"></i> 새로고침</button>
        </div>
    </div>
    <div class="path-info">${this.pythonPath || 'Python 환경이 선택되지 않았습니다'}</div>

    ${!hasPython ? `
        <div class="no-python">
            <i class="codicon codicon-warning"></i>
            <p>Python 환경이 선택되지 않았습니다.</p>
            <p style="font-size:12px;">먼저 Python 가상환경을 선택한 후 pip 패키지를 관리할 수 있습니다.</p>
        </div>
    ` : `
        <div class="search-bar">
            <div class="input-wrapper">
                <span class="input-icon"><i class="codicon codicon-search"></i></span>
                <input type="text" id="packageInput" placeholder="패키지 검색 및 설치 (예: flask, requests==2.31.0)" />
                <div class="input-actions">
                    <button class="btn-primary" onclick="installPackage()"><i class="codicon codicon-cloud-download"></i> 설치</button>
                </div>
            </div>
            <div id="filterHint" class="filter-hint"></div>
        </div>

        ${packages.length === 0 ? `
            <div class="empty-state">
                <p>설치된 패키지가 없습니다.</p>
                <p style="font-size:12px;">위 입력란에서 패키지를 설치해 보세요.</p>
            </div>
        ` : `
            <div class="card" id="packagesCard">
                <div class="card-header">
                    <span class="card-title">installed packages</span>
                    <span class="badge" id="pkgCount">${packages.length}</span>
                </div>
                <div class="card-body">
                    <table>
                        <thead><tr><th>패키지</th><th>버전</th><th>최신</th><th style="text-align:right; width:80px;">작업</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `}
    `}

    <div id="statusBar" class="status-bar"></div>
</div>

<script>
    const vscode = acquireVsCodeApi();

    function installPackage() {
        const input = document.getElementById('packageInput');
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        vscode.postMessage({ command: 'install', packageName: name });
        input.value = '';
    }

    function uninstallPackage(name) {
        vscode.postMessage({ command: 'uninstall', packageName: name });
    }

    function upgradePackage(name) {
        vscode.postMessage({ command: 'upgrade', packageName: name });
    }

    function upgradeAll() {
        vscode.postMessage({ command: 'upgradeAll' });
    }

    function refresh() {
        vscode.postMessage({ command: 'refresh' });
    }

    function checkOutdated() {
        vscode.postMessage({ command: 'getOutdated' });
    }

    var pkgInput = document.getElementById('packageInput');
    if (pkgInput) {
        pkgInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') installPackage();
        });
        pkgInput.addEventListener('input', function() { filterPackages(); });
    }

    function filterPackages() {
        var query = (document.getElementById('packageInput').value || '').trim().toLowerCase();
        var hint = document.getElementById('filterHint');
        var rows = document.querySelectorAll('tr[data-name]');
        var card = document.getElementById('packagesCard');
        var badge = document.getElementById('pkgCount');

        if (!query) {
            rows.forEach(function(r) { r.classList.remove('filtered'); });
            if (card) card.classList.remove('hidden');
            if (badge) badge.textContent = rows.length;
            if (hint) { hint.classList.remove('visible'); hint.textContent = ''; }
            return;
        }

        var visible = 0;
        rows.forEach(function(row) {
            var name = (row.getAttribute('data-name') || '').toLowerCase();
            if (name.indexOf(query) !== -1) {
                row.classList.remove('filtered');
                visible++;
            } else {
                row.classList.add('filtered');
            }
        });

        if (badge) badge.textContent = visible;
        if (card) card.classList.toggle('hidden', visible === 0);

        if (hint) {
            if (visible === 0) {
                hint.classList.add('visible');
                hint.textContent = '"' + query + '" - 검색 결과 없음. Enter 또는 설치 버튼으로 새로 설치';
            } else {
                hint.classList.add('visible');
                hint.textContent = visible + '개 패키지 일치';
            }
        }
    }

    window.addEventListener('message', function(event) {
        var msg = event.data;
        var bar = document.getElementById('statusBar');
        if (!bar) return;

        bar.className = 'status-bar';

        switch (msg.command) {
            case 'loading':
                bar.className = 'status-bar loading';
                bar.textContent = msg.text || '처리 중...';
                break;
            case 'success':
                bar.className = 'status-bar success';
                bar.textContent = msg.text || '완료';
                setTimeout(function() { bar.className = 'status-bar'; }, 3000);
                break;
            case 'error':
                bar.className = 'status-bar error';
                bar.textContent = msg.text || '오류 발생';
                setTimeout(function() { bar.className = 'status-bar'; }, 5000);
                break;
            case 'outdatedResult':
                updateOutdatedInfo(msg.data);
                bar.className = 'status-bar success';
                bar.textContent = '업데이트 확인 완료';
                setTimeout(function() { bar.className = 'status-bar'; }, 3000);
                break;
        }
    });

    function updateOutdatedInfo(outdated) {
        var rows = document.querySelectorAll('tr[data-name]');
        rows.forEach(function(row) {
            var name = row.getAttribute('data-name');
            var latestCell = row.querySelector('.pkg-latest');
            if (!latestCell) return;

            if (outdated[name]) {
                latestCell.innerHTML = '<span class="outdated">' + outdated[name] + '</span>';
            } else {
                latestCell.innerHTML = '<span class="up-to-date">\\u2713 latest</span>';
            }
        });
    }
</script>
</body>
</html>`;
    }
}

module.exports = PipEditor;
