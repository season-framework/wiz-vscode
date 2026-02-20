/**
 * McpManager - MCP 서버 관리
 * MCP 서버 시작/중지, 설정 생성
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');

class McpManager {
    /**
     * @param {Object} options
     * @param {string} options.extensionPath - 익스텐션 경로
     * @param {Function} options.getWizRoot - Wiz 루트 경로 반환 함수
     * @param {Function} options.getCurrentProject - 현재 프로젝트명 반환 함수
     */
    constructor(options = {}) {
        this.extensionPath = options.extensionPath;
        this.getWizRoot = options.getWizRoot || (() => undefined);
        this.getCurrentProject = options.getCurrentProject || (() => 'main');
        this.outputChannel = vscode.window.createOutputChannel('Wiz MCP Server');
        this.serverProcess = null;
        this._updateContext();
        this.updateMcpConfigContext();
        this._watchMcpConfig();
        // 초기 상태 파일 기록 (MCP 서버와 동기화용)
        this.writeState();
    }

    /**
     * Context key 업데이트 (메뉴 when 조건용)
     * @private
     */
    _updateContext() {
        vscode.commands.executeCommand('setContext', 'wizExplorer:mcpServerRunning', this.serverProcess !== null);
    }

    /**
     * .vscode/mcp.json 파일 변경 감지 워처
     * @private
     */
    _watchMcpConfig() {
        this._mcpConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/mcp.json');
        this._mcpConfigWatcher.onDidCreate(() => this.updateMcpConfigContext());
        this._mcpConfigWatcher.onDidDelete(() => this.updateMcpConfigContext());
    }

    /**
     * MCP 서버 시작
     * @returns {boolean} 시작 성공 여부
     */
    start() {
        if (this.serverProcess) {
            vscode.window.showWarningMessage('MCP 서버가 이미 실행 중입니다.');
            return false;
        }

        const mcpServerPath = path.join(this.extensionPath, 'src', 'mcp', 'index.js');
        const wizRoot = this.getWizRoot();

        const nodeModulesPath = path.join(this.extensionPath, 'node_modules');
        this.serverProcess = cp.spawn('node', [mcpServerPath], {
            cwd: wizRoot,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_PATH: nodeModulesPath }
        });

        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] MCP Server started`);
        this.outputChannel.show(true);

        this.serverProcess.stderr.on('data', (data) => {
            this.outputChannel.appendLine(data.toString());
        });

        this.serverProcess.on('close', (code) => {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] MCP Server stopped (code: ${code})`);
            this.serverProcess = null;
            this._updateContext();
        });

        this.serverProcess.on('error', (err) => {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] MCP Server error: ${err.message}`);
            this.serverProcess = null;
            this._updateContext();
        });

        this._updateContext();
        vscode.window.showInformationMessage('MCP 서버가 시작되었습니다.');
        return true;
    }

    /**
     * MCP 서버 중지
     * @returns {boolean} 중지 성공 여부
     */
    stop() {
        if (!this.serverProcess) {
            vscode.window.showWarningMessage('실행 중인 MCP 서버가 없습니다.');
            return false;
        }

        this.serverProcess.kill();
        this.serverProcess = null;
        this._updateContext();
        vscode.window.showInformationMessage('MCP 서버가 중지되었습니다.');
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
     * mcp.json 존재 여부 context key 업데이트
     */
    updateMcpConfigContext() {
        const mcpJsonPath = this._getMcpJsonPath();
        const exists = mcpJsonPath ? fs.existsSync(mcpJsonPath) : false;
        vscode.commands.executeCommand('setContext', 'wizExplorer:mcpConfigExists', exists);
    }

    /**
     * 상태 파일(.vscode/.wiz-state.json) 기록
     * MCP 서버가 현재 Explorer 프로젝트를 인식할 수 있도록 동기화
     */
    writeState() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        const statePath = path.join(vscodeDir, '.wiz-state.json');
        const state = {
            workspacePath: this.getWizRoot() || '',
            currentProject: this.getCurrentProject() || 'main'
        };

        try {
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
        } catch (e) { /* skip */ }
    }

    /**
     * MCP 설정 객체 생성
     * @returns {Object} MCP 설정 객체
     */
    getConfig() {
        return {
            servers: {
                wiz: {
                    command: 'node',
                    args: [path.join(this.extensionPath, 'src', 'mcp', 'index.js')],
                    env: {
                        WIZ_WORKSPACE: this.getWizRoot() || ''
                    }
                }
            }
        };
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

        if (fs.existsSync(mcpJsonPath)) {
            // 이미 존재하면 showConfig로 위임
            return this.showConfig();
        }

        const config = this.getConfig();
        const configJson = JSON.stringify(config, null, 2);

        // .vscode 디렉토리 생성
        const vscodeDir = path.dirname(mcpJsonPath);
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        // 파일 저장
        fs.writeFileSync(mcpJsonPath, configJson, 'utf8');
        this.updateMcpConfigContext();

        // 파일 열기
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
            // 파일이 없으면 createConfig로 위임
            return this.createConfig();
        }

        // 기존 파일 열기
        const doc = await vscode.workspace.openTextDocument(mcpJsonPath);
        await vscode.window.showTextDocument(doc);
    }

    /**
     * 서버 실행 중 여부
     * @returns {boolean}
     */
    isRunning() {
        return this.serverProcess !== null;
    }

    /**
     * 리소스 정리
     */
    dispose() {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        if (this._mcpConfigWatcher) {
            this._mcpConfigWatcher.dispose();
        }
        this.outputChannel.dispose();
    }
}

module.exports = McpManager;
