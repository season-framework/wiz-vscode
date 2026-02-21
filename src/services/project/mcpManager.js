/**
 * McpManager - MCP 서버 관리
 * VS Code 네이티브 MCP 관리 체계(.vscode/mcp.json)와 연동
 * mcp.json 설정을 통해 VS Code가 MCP 서버 수명주기를 직접 관리
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class McpManager {
    /**
     * @param {Object} options
     * @param {string} options.extensionPath - 익스텐션 경로
     * @param {Function} options.getWizRoot - Wiz 루트 경로 반환 함수
     * @param {Function} options.getCurrentProject - 현재 프로젝트명 반환 함수
     * @param {Function} options.onStateChange - 상태 변경 콜백
     */
    /** @type {number} 세션 만료 기간 (7일, ms) */
    static SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

    constructor(options = {}) {
        this.extensionPath = options.extensionPath;
        this.getWizRoot = options.getWizRoot || (() => undefined);
        this.getCurrentProject = options.getCurrentProject || (() => 'main');
        this.onStateChange = options.onStateChange || (() => {});
        this.sessionId = vscode.env.sessionId;
        this._notifyState();
        this._watchMcpConfig();
        // 만료 세션 정리 후 상태 파일 기록 (MCP 서버와 동기화용)
        this.cleanupSessions();
        this.writeState();
    }

    /**
     * 상태 알림 (트리뷰 갱신 + context key 업데이트)
     * @private
     */
    _notifyState() {
        const wizServerExists = this._hasWizServer();
        vscode.commands.executeCommand('setContext', 'wizExplorer:mcpConfigExists', wizServerExists);
        this.onStateChange({
            mcpServerRunning: wizServerExists,
            mcpConfigExists: wizServerExists
        });
    }

    /**
     * .vscode/mcp.json 파일 변경 감지 워처
     * @private
     */
    _watchMcpConfig() {
        this._mcpConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/mcp.json');
        this._mcpConfigWatcher.onDidCreate(() => this._notifyState());
        this._mcpConfigWatcher.onDidChange(() => this._notifyState());
        this._mcpConfigWatcher.onDidDelete(() => this._notifyState());
    }

    /**
     * mcp.json에 wiz 서버가 설정되어 있는지 확인
     * @returns {boolean}
     * @private
     */
    _hasWizServer() {
        const mcpJsonPath = this._getMcpJsonPath();
        if (!mcpJsonPath || !fs.existsSync(mcpJsonPath)) return false;
        try {
            const config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
            return !!(config.servers && config.servers.wiz);
        } catch (e) {
            return false;
        }
    }

    /**
     * MCP 서버 활성화 (mcp.json에 wiz 서버 설정 추가)
     * VS Code가 자동으로 서버 수명주기를 관리
     */
    async start() {
        if (this._hasWizServer()) {
            vscode.window.showInformationMessage('MCP 서버가 이미 설정되어 있습니다. VS Code가 자동으로 관리합니다.');
            return false;
        }

        await this._ensureConfig();
        this._notifyState();
        vscode.window.showInformationMessage('MCP 서버가 활성화되었습니다. VS Code가 자동으로 관리합니다.');
        return true;
    }

    /**
     * MCP 서버 비활성화 (mcp.json에서 wiz 서버 설정 제거)
     */
    stop() {
        const mcpJsonPath = this._getMcpJsonPath();
        if (!mcpJsonPath || !fs.existsSync(mcpJsonPath)) {
            vscode.window.showWarningMessage('MCP 설정 파일이 없습니다.');
            return false;
        }

        try {
            const config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
            if (!config.servers || !config.servers.wiz) {
                vscode.window.showWarningMessage('MCP wiz 서버 설정이 없습니다.');
                return false;
            }

            delete config.servers.wiz;

            // 다른 서버 설정이 남아있으면 파일 유지, 아니면 삭제
            if (Object.keys(config.servers).length === 0) {
                fs.unlinkSync(mcpJsonPath);
            } else {
                fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), 'utf8');
            }
        } catch (e) {
            // 파싱 실패 시 파일 삭제
            fs.unlinkSync(mcpJsonPath);
        }

        this._notifyState();
        vscode.window.showInformationMessage('MCP 서버가 비활성화되었습니다.');
        return true;
    }

    /**
     * .vscode/mcp.json 파일 경로 반환
     * @returns {string|undefined}
     * @private
     */
    _getMcpJsonPath() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return undefined;
        return path.join(workspaceFolder.uri.fsPath, '.vscode', 'mcp.json');
    }

    /**
     * mcp.json 상태 업데이트 (외부 호출용)
     */
    updateMcpConfigContext() {
        this._notifyState();
    }

    /**
     * 상태 파일(.vscode/.wiz-state.json) 경로 반환
     * @returns {string|undefined}
     * @private
     */
    _getStatePath() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return undefined;
        return path.join(workspaceFolder.uri.fsPath, '.vscode', '.wiz-state.json');
    }

    /**
     * 상태 파일 읽기 (세션 맵 반환)
     * @returns {{ sessions: Object<string, { workspacePath: string, currentProject: string, lastUsed: number }> }}
     * @private
     */
    _readStateFile() {
        const statePath = this._getStatePath();
        if (!statePath || !fs.existsSync(statePath)) return { sessions: {} };
        try {
            const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            // 구버전 호환: sessions 키가 없으면 단일 세션으로 마이그레이션
            if (!raw.sessions) {
                return {
                    sessions: {
                        _migrated: {
                            workspacePath: raw.workspacePath || '',
                            currentProject: raw.currentProject || 'main',
                            lastUsed: Date.now()
                        }
                    }
                };
            }
            return raw;
        } catch (e) {
            return { sessions: {} };
        }
    }

    /**
     * 상태 파일 쓰기
     * @param {{ sessions: Object }} stateData
     * @private
     */
    _writeStateFile(stateData) {
        const statePath = this._getStatePath();
        if (!statePath) return;
        const dir = path.dirname(statePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        try {
            fs.writeFileSync(statePath, JSON.stringify(stateData, null, 2), 'utf8');
        } catch (e) { /* skip */ }
    }

    /**
     * 현재 세션 상태를 상태 파일에 기록
     * MCP 서버가 현재 Explorer 프로젝트를 인식할 수 있도록 동기화
     */
    writeState() {
        const stateData = this._readStateFile();
        stateData.sessions[this.sessionId] = {
            workspacePath: this.getWizRoot() || '',
            currentProject: this.getCurrentProject() || 'main',
            lastUsed: Date.now()
        };
        this._writeStateFile(stateData);
    }

    /**
     * 일주일 이상 사용되지 않은 세션 정리
     */
    cleanupSessions() {
        const stateData = this._readStateFile();
        const now = Date.now();
        let changed = false;
        for (const [id, session] of Object.entries(stateData.sessions)) {
            if (now - (session.lastUsed || 0) > McpManager.SESSION_EXPIRY_MS) {
                delete stateData.sessions[id];
                changed = true;
            }
        }
        if (changed) {
            this._writeStateFile(stateData);
        }
    }

    /**
     * 현재 세션 제거
     */
    removeSession() {
        const stateData = this._readStateFile();
        if (stateData.sessions[this.sessionId]) {
            delete stateData.sessions[this.sessionId];
            this._writeStateFile(stateData);
        }
    }

    /**
     * wiz 서버 설정 객체 생성
     * ${extensionInstallFolder:publisher.extensionId} 변수를 사용하여
     * 어떤 환경에서든 올바른 익스텐션 경로를 참조할 수 있도록 함
     * @returns {Object} wiz 서버 설정
     * @private
     */
    _getWizServerConfig() {
        const extFolder = '${extensionInstallFolder:season-framework.wiz-vscode}';
        return {
            command: 'node',
            args: [`${extFolder}/src/mcp/index.js`],
            env: {
                NODE_PATH: `${extFolder}/node_modules`,
                WIZ_WORKSPACE: this.getWizRoot() || ''
            }
        };
    }

    /**
     * 전체 mcp.json 설정 객체 생성
     * @returns {Object} MCP 설정 객체
     */
    getConfig() {
        return {
            servers: {
                wiz: this._getWizServerConfig()
            }
        };
    }

    /**
     * mcp.json에 wiz 서버 설정 보장 (없으면 생성/추가)
     * @private
     */
    async _ensureConfig() {
        const mcpJsonPath = this._getMcpJsonPath();
        if (!mcpJsonPath) {
            vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
            return;
        }

        const vscodeDir = path.dirname(mcpJsonPath);
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        let config = { servers: {} };
        if (fs.existsSync(mcpJsonPath)) {
            try {
                config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf8'));
                if (!config.servers) config.servers = {};
            } catch (e) {
                config = { servers: {} };
            }
        }

        config.servers.wiz = this._getWizServerConfig();
        fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), 'utf8');
    }

    /**
     * MCP 설정 파일(.vscode/mcp.json) 생성 후 열기
     */
    async createConfig() {
        const mcpJsonPath = this._getMcpJsonPath();
        if (!mcpJsonPath) {
            vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
            return;
        }

        if (this._hasWizServer()) {
            return this.showConfig();
        }

        await this._ensureConfig();
        this._notifyState();

        const doc = await vscode.workspace.openTextDocument(mcpJsonPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage('MCP 설정 파일이 생성되었습니다: .vscode/mcp.json');
    }

    /**
     * MCP 설정 파일 열기 (이미 존재하는 경우)
     */
    async showConfig() {
        const mcpJsonPath = this._getMcpJsonPath();
        if (!mcpJsonPath) {
            vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
            return;
        }

        if (!fs.existsSync(mcpJsonPath)) {
            return this.createConfig();
        }

        const doc = await vscode.workspace.openTextDocument(mcpJsonPath);
        await vscode.window.showTextDocument(doc);
    }

    /**
     * MCP 설정 초기화 (wiz 서버 재설정 → 에디터에서 열기)
     */
    async resetConfig() {
        const mcpJsonPath = this._getMcpJsonPath();
        if (!mcpJsonPath) {
            vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
            return;
        }

        // 기존 mcp.json 삭제
        if (fs.existsSync(mcpJsonPath)) {
            fs.unlinkSync(mcpJsonPath);
        }

        // 설정 재생성
        await this._ensureConfig();
        this._notifyState();

        const doc = await vscode.workspace.openTextDocument(mcpJsonPath);
        await vscode.window.showTextDocument(doc);

        vscode.window.showInformationMessage('MCP 설정이 초기화되었습니다.');
    }

    /**
     * wiz 서버 활성화 여부
     * @returns {boolean}
     */
    isRunning() {
        return this._hasWizServer();
    }

    /**
     * 리소스 정리 (세션 제거 포함)
     */
    dispose() {
        this.removeSession();
        if (this._mcpConfigWatcher) {
            this._mcpConfigWatcher.dispose();
        }
    }
}

module.exports = McpManager;
