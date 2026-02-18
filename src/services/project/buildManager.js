/**
 * BuildManager - 프로젝트 빌드 관리
 * 빌드 트리거, Normal/Clean 빌드, 출력 채널 관리, 저장 시 자동 빌드
 */

const vscode = require('vscode');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { WizPathUtils } = require('../../core');

class BuildManager {
    /**
     * @param {Object} options
     * @param {Function} options.getWizRoot - Wiz 루트 경로 반환 함수
     * @param {Function} options.getCurrentProject - 현재 프로젝트명 반환 함수
     */
    constructor(options = {}) {
        this.getWizRoot = options.getWizRoot || (() => undefined);
        this.getCurrentProject = options.getCurrentProject || (() => undefined);
        this.outputChannel = vscode.window.createOutputChannel('Wiz Build');
        this.buildProcess = null;
        this.selectedPythonPath = this._readConfiguredPythonPath();
        /** @private 편집된 document URI 추적 Set */
        this._editedDocuments = new Set();
    }

    // ==================== Save Watcher ====================

    /**
     * 파일 저장 시 자동 빌드 이벤트 리스너를 등록한다.
     * onDidChangeTextDocument로 편집 여부를 추적하고,
     * onDidSaveTextDocument에서 실제 편집된 경우에만 빌드를 트리거한다.
     * 
     * 기존 onWillSaveTextDocument 방식은 wiz:// 커스텀 스킴에서
     * 이벤트가 발생하지 않는 경우가 있어, onDidChangeTextDocument 방식으로 변경.
     * @param {vscode.ExtensionContext} context
     */
    registerSaveWatcher(context) {
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.contentChanges.length > 0) {
                    this._editedDocuments.add(event.document.uri.toString());
                }
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument((document) => {
                const key = document.uri.toString();
                const wasEdited = this._editedDocuments.has(key);
                this._editedDocuments.delete(key);

                if (!wasEdited) return;
                if (!this._isWizWorkspaceForCurrentProject()) return;

                const realPath = this._resolveDocumentRealPath(document);
                if (!realPath) return;
                if (!this._isInCurrentProjectSrc(realPath)) return;

                this.triggerBuild();
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidCloseTextDocument((document) => {
                this._editedDocuments.delete(document.uri.toString());
            })
        );
    }

    /**
     * 현재 프로젝트의 src 루트 경로 반환
     * @private
     * @returns {string|undefined}
     */
    _getCurrentProjectSrcRoot() {
        const wizRoot = this.getWizRoot();
        const currentProject = this.getCurrentProject();
        if (!wizRoot || !currentProject) return undefined;
        return path.join(wizRoot, 'project', currentProject, 'src');
    }

    /**
     * 현재 프로젝트의 src 폴더가 존재하는지 확인
     * @private
     * @returns {boolean}
     */
    _isWizWorkspaceForCurrentProject() {
        const srcRoot = this._getCurrentProjectSrcRoot();
        return !!(srcRoot && fs.existsSync(srcRoot));
    }

    /**
     * document의 실제 파일 경로를 반환 (wiz:// 스킴 지원)
     * @private
     * @param {vscode.TextDocument} document
     * @returns {string|null}
     */
    _resolveDocumentRealPath(document) {
        const uri = document.uri;
        if (uri.scheme === 'wiz') {
            return WizPathUtils.getRealPathFromUri(uri) || null;
        }
        if (uri.scheme === 'file') {
            return uri.fsPath;
        }
        return null;
    }

    /**
     * 파일 경로가 현재 프로젝트 src 안에 있는지 확인
     * @private
     * @param {string} filePath
     * @returns {boolean}
     */
    _isInCurrentProjectSrc(filePath) {
        const srcRoot = this._getCurrentProjectSrcRoot();
        if (!srcRoot || !filePath) return false;

        const normalizedSrcRoot = path.normalize(srcRoot);
        const normalizedFilePath = path.normalize(filePath);

        return normalizedFilePath === normalizedSrcRoot || normalizedFilePath.startsWith(normalizedSrcRoot + path.sep);
    }

    /**
     * 출력 채널 반환
     * @returns {vscode.OutputChannel}
     */
    getOutputChannel() {
        return this.outputChannel;
    }

    /**
     * ANSI 색상 코드 제거
     * @private
     */
    _stripAnsi(str) {
        return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
    }

    _readConfiguredPythonPath() {
        const configured = vscode.workspace
            .getConfiguration('wizExplorer')
            .get('build.pythonInterpreterPath', '');
        return (configured || '').trim();
    }

    async _writeConfiguredPythonPath(interpreterPath) {
        this.selectedPythonPath = interpreterPath || '';
        await vscode.workspace
            .getConfiguration('wizExplorer')
            .update('build.pythonInterpreterPath', this.selectedPythonPath, vscode.ConfigurationTarget.Workspace);
    }

    _resolveWorkspaceVariable(value) {
        if (!value) return value;
        const wizRoot = this.getWizRoot();
        if (!wizRoot) return value;
        return value.replace(/\$\{workspaceFolder\}/g, wizRoot);
    }

    _isValidInterpreterPath(interpreterPath) {
        if (!interpreterPath) return false;
        const resolved = this._resolveWorkspaceVariable(interpreterPath);
        return fs.existsSync(resolved);
    }

    _getWizExecutableFromInterpreter(interpreterPath) {
        if (!this._isValidInterpreterPath(interpreterPath)) {
            return '';
        }

        const resolvedInterpreter = this._resolveWorkspaceVariable(interpreterPath);
        const binDir = path.dirname(resolvedInterpreter);
        const candidates = process.platform === 'win32'
            ? ['wiz.exe', 'wiz.cmd', 'wiz.bat']
            : ['wiz'];

        for (const candidate of candidates) {
            const candidatePath = path.join(binDir, candidate);
            if (fs.existsSync(candidatePath)) {
                return candidatePath;
            }
        }

        return '';
    }

    _formatCommandForLog(executable, args) {
        const quoteIfNeeded = (value) => {
            if (value === undefined || value === null) return '';
            const text = String(value);
            if (text.includes(' ') || text.includes('"')) {
                return `"${text.replace(/"/g, '\\"')}"`;
            }
            return text;
        };

        const commandParts = [quoteIfNeeded(executable)].concat((args || []).map(quoteIfNeeded));
        return commandParts.join(' ');
    }

    async _hasPythonInterpreterSelector() {
        const availableCommands = await vscode.commands.getCommands(true);
        return availableCommands.includes('python.setInterpreter');
    }

    _readPythonInterpreterFromConfig() {
        const wizRoot = this.getWizRoot();
        const resource = wizRoot ? vscode.Uri.file(wizRoot) : undefined;
        const pythonConfig = vscode.workspace.getConfiguration('python', resource);
        const configured = pythonConfig.get('defaultInterpreterPath') || pythonConfig.get('pythonPath') || '';
        return this._resolveWorkspaceVariable((configured || '').trim());
    }

    async _readPythonInterpreterFromCommand() {
        const availableCommands = await vscode.commands.getCommands(true);
        if (!availableCommands.includes('python.interpreterPath')) {
            return '';
        }

        const wizRoot = this.getWizRoot();
        const resource = wizRoot ? vscode.Uri.file(wizRoot) : undefined;
        const result = resource
            ? await vscode.commands.executeCommand('python.interpreterPath', resource)
            : await vscode.commands.executeCommand('python.interpreterPath');

        if (!result) return '';
        if (typeof result === 'string') return this._resolveWorkspaceVariable(result.trim());
        if (typeof result === 'object') {
            const pathValue = typeof result.path === 'string'
                ? result.path
                : (typeof result.fsPath === 'string' ? result.fsPath : '');
            return this._resolveWorkspaceVariable((pathValue || '').trim());
        }

        return '';
    }

    _isWizNotFound(result) {
        if (!result) return false;
        const stderrText = (result.stderrText || '').toLowerCase();
        const errorMessage = ((result.error && result.error.message) || '').toLowerCase();
        const errorCode = result.error && result.error.code;

        return errorCode === 'ENOENT'
            || result.code === 127
            || stderrText.includes('command not found')
            || stderrText.includes("'wiz' is not recognized")
            || stderrText.includes('"wiz" is not recognized')
            || errorMessage.includes('not found')
            || errorMessage.includes('enoent');
    }

    async _runBuildProcess(executable, args, buildCwd) {
        return new Promise((resolve) => {
            let stderrText = '';
            let settled = false;
            const fullCommand = this._formatCommandForLog(executable, args);

            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Running: ${fullCommand}`);

            const processHandle = cp.spawn(executable, args, {
                cwd: buildCwd,
                shell: false,
                env: {
                    ...process.env,
                    NO_COLOR: '1',
                    FORCE_COLOR: '0',
                    PWD: buildCwd,
                    WIZ_ROOT: buildCwd,
                    WIZ_HOME: buildCwd
                }
            });

            this.buildProcess = processHandle;

            processHandle.stdout.on('data', (data) => {
                this.outputChannel.append(this._stripAnsi(data.toString()));
            });

            processHandle.stderr.on('data', (data) => {
                const text = data.toString();
                stderrText += text;
                this.outputChannel.append(this._stripAnsi(text));
            });

            processHandle.on('close', (code) => {
                if (settled) return;
                settled = true;
                this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Build finished with code ${code}`);
                this.buildProcess = null;
                resolve({ code, stderrText, error: null });
            });

            processHandle.on('error', (err) => {
                if (settled) return;
                settled = true;
                this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Build error: ${err.message}`);
                this.buildProcess = null;
                resolve({ code: null, stderrText, error: err });
            });
        });
    }

    async _selectInterpreterWithPythonExtension() {
        const hasSelector = await this._hasPythonInterpreterSelector();
        if (!hasSelector) {
            return null;
        }

        try {
            await vscode.commands.executeCommand('python.setInterpreter');
        } catch (_) {
            return null;
        }

        let selectedPath = '';
        try {
            selectedPath = await this._readPythonInterpreterFromCommand();
        } catch (_) {
            selectedPath = '';
        }

        if (!this._isValidInterpreterPath(selectedPath)) {
            selectedPath = this._readPythonInterpreterFromConfig();
        }

        if (this._isValidInterpreterPath(selectedPath)) {
            await this._writeConfiguredPythonPath(selectedPath);
            return selectedPath;
        }

        return null;
    }

    async _selectInterpreterByPath() {
        const wizRoot = this.getWizRoot();
        const entered = await vscode.window.showInputBox({
            title: 'Wiz 빌드용 Python 실행 파일 경로',
            prompt: '예: /Users/name/miniconda3/envs/wiz/bin/python',
            placeHolder: 'python 실행 파일의 절대 경로를 입력하세요',
            value: this.selectedPythonPath || ''
        });

        if (!entered) return null;

        const trimmed = entered.trim();
        const resolvedPath = path.isAbsolute(trimmed)
            ? trimmed
            : (wizRoot ? path.resolve(wizRoot, trimmed) : trimmed);

        if (!this._isValidInterpreterPath(resolvedPath)) {
            vscode.window.showErrorMessage(`유효한 Python 실행 파일을 찾을 수 없습니다: ${resolvedPath}`);
            return null;
        }

        await this._writeConfiguredPythonPath(resolvedPath);
        return resolvedPath;
    }

    async _resolvePythonInterpreter({ forcePick = false } = {}) {
        if (!forcePick && this._isValidInterpreterPath(this.selectedPythonPath)) {
            return this._resolveWorkspaceVariable(this.selectedPythonPath);
        }

        if (!forcePick) {
            const fromConfig = this._readPythonInterpreterFromConfig();
            if (this._isValidInterpreterPath(fromConfig)) {
                await this._writeConfiguredPythonPath(fromConfig);
                return fromConfig;
            }
        }

        const hasSelector = await this._hasPythonInterpreterSelector();
        if (hasSelector) {
            const selectedByExtension = await this._selectInterpreterWithPythonExtension();
            if (selectedByExtension) {
                return selectedByExtension;
            }
            vscode.window.showInformationMessage('인터프리터 선택 결과를 확인할 수 없어 Python 경로를 직접 입력받습니다.');
        } else {
            vscode.window.showInformationMessage('Python 인터프리터 선택 확장을 찾지 못해 직접 경로 입력으로 진행합니다.');
        }

        return this._selectInterpreterByPath();
    }

    async _runBuildWithInterpreter(interpreterPath, args, buildCwd) {
        const wizExecutable = this._getWizExecutableFromInterpreter(interpreterPath);
        if (!wizExecutable) {
            return false;
        }

        await this._runBuildProcess(wizExecutable, args, buildCwd);
        return true;
    }

    async _pickInterpreterAndRunBuild(args, buildCwd, forcePick) {
        const pythonInterpreter = await this._resolvePythonInterpreter({ forcePick });
        if (!pythonInterpreter) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Python 환경 선택이 취소되어 빌드를 중단했습니다.`);
            return false;
        }

        const executed = await this._runBuildWithInterpreter(pythonInterpreter, args, buildCwd);
        if (!executed) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 선택된 Python 환경에서 wiz 실행 파일을 찾지 못했습니다: ${pythonInterpreter}`);
            vscode.window.showErrorMessage('선택한 Python 환경에서 wiz 실행 파일을 찾지 못했습니다. wiz가 설치된 환경을 선택하세요.');
            return false;
        }

        return true;
    }

    async _triggerBuildInternal(clean = false) {
        const currentProject = this.getCurrentProject();
        const wizRoot = this.getWizRoot();

        if (!currentProject || !wizRoot) {
            return false;
        }

        const args = ['project', 'build', '--project', currentProject];
        if (clean) {
            args.push('--clean');
        }

        const buildCwd = wizRoot;

        const buildType = clean ? 'Clean Build' : 'Build';
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${buildType} project: ${currentProject}...`);

        const configuredInterpreter = this._resolveWorkspaceVariable(this.selectedPythonPath);
        const builtWithConfiguredInterpreter = await this._runBuildWithInterpreter(configuredInterpreter, args, buildCwd);
        if (builtWithConfiguredInterpreter) {
            return true;
        }

        if ((this.selectedPythonPath || '').trim()) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 저장된 Python 환경에서 wiz 실행 파일을 찾지 못했습니다. 환경을 다시 선택합니다.`);
            return this._pickInterpreterAndRunBuild(args, buildCwd, true);
        }

        const initialResult = await this._runBuildProcess('wiz', args, buildCwd);
        if (!this._isWizNotFound(initialResult)) {
            return true;
        }

        const shouldPrompt = vscode.workspace
            .getConfiguration('wizExplorer')
            .get('build.promptPythonSelectionOnMissingWiz', true);

        if (!shouldPrompt) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 'wiz' 명령을 찾을 수 없습니다. wizExplorer.build.pythonInterpreterPath 설정을 확인하세요.`);
            return false;
        }

        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] 'wiz' 명령을 찾을 수 없어 Python 환경 선택 후 재시도합니다.`);
        return this._pickInterpreterAndRunBuild(args, buildCwd, false);
    }

    /**
     * 빌드 실행
     * @param {boolean} [clean=false] - Clean 빌드 여부
     * @returns {boolean} 빌드 시작 성공 여부
     */
    triggerBuild(clean = false) {
        // 이전 빌드 프로세스가 실행 중이면 종료
        if (this.buildProcess) {
            this.buildProcess.kill();
            this.buildProcess = null;
        }

        this._triggerBuildInternal(clean).catch((err) => {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Build error: ${err.message}`);
            this.buildProcess = null;
        });

        return true;
    }

    async selectBuildPythonInterpreter() {
        const pythonInterpreter = await this._resolvePythonInterpreter({ forcePick: true });
        if (!pythonInterpreter) {
            return false;
        }

        vscode.window.showInformationMessage(`Wiz 빌드 Python 환경이 설정되었습니다: ${pythonInterpreter}`);
        return true;
    }

    /**
     * Normal 빌드 실행
     * @returns {boolean} 성공 여부
     */
    normalBuild() {
        const currentProject = this.getCurrentProject();
        if (!currentProject) {
            vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
            return false;
        }
        return this.triggerBuild(false);
    }

    /**
     * Clean 빌드 실행
     * @returns {boolean} 성공 여부
     */
    cleanBuild() {
        const currentProject = this.getCurrentProject();
        if (!currentProject) {
            vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
            return false;
        }
        return this.triggerBuild(true);
    }

    /**
     * 빌드 타입 선택 후 실행
     * @returns {Promise<boolean>} 성공 여부
     */
    async showBuildMenu() {
        const currentProject = this.getCurrentProject();
        if (!currentProject) {
            vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
            return false;
        }

        const buildOptions = [
            { label: '$(tools) Normal Build', description: '현재 상태에서 빌드', value: false },
            { label: '$(trash) Clean Build', description: '기존 빌드 결과물 삭제 후 빌드', value: true }
        ];

        const selected = await vscode.window.showQuickPick(buildOptions, {
            title: '빌드 타입 선택',
            placeHolder: '빌드 방식을 선택하세요'
        });

        if (selected) {
            return this.triggerBuild(selected.value);
        }
        return false;
    }

    /**
     * 빌드 출력 채널 표시
     */
    showOutput() {
        this.outputChannel.show(true);
    }

    /**
     * 리소스 정리
     */
    dispose() {
        if (this.buildProcess) {
            this.buildProcess.kill();
            this.buildProcess = null;
        }
        this.outputChannel.dispose();
    }
}

module.exports = BuildManager;
