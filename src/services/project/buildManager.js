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
        /** @private 빌드 디바운스 타이머 */
        this._buildTimer = null;
    }

    // ==================== Save Watcher ====================

    /**
     * 편집 추적 Set 초기화 (프로젝트 전환 시 호출)
     */
    clearEditedDocuments() {
        this._editedDocuments.clear();
    }

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
     * 현재 선택된 Python 인터프리터의 resolved 경로를 반환
     * @returns {string}
     */
    getResolvedPythonPath() {
        return this._resolveWorkspaceVariable(this.selectedPythonPath) || '';
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

    /**
     * 시스템에서 사용 가능한 Python 인터프리터를 자동으로 탐색한다.
     * which/where, conda, pyenv, 워크스페이스 venv 등을 검색한다.
     * @returns {Promise<Array<{path: string, label: string, detail: string}>>}
     * @private
     */
    async _discoverPythonInterpreters() {
        const found = new Map(); // path → { label, detail }

        const addIfValid = (pythonPath, source) => {
            if (!pythonPath) return;
            const resolved = this._resolveWorkspaceVariable(pythonPath.trim());
            if (!resolved || found.has(resolved)) return;
            try {
                if (fs.existsSync(resolved)) {
                    found.set(resolved, { source });
                }
            } catch (_) { /* ignore */ }
        };

        const execPromise = (cmd) => {
            return new Promise((resolve) => {
                cp.exec(cmd, { timeout: 5000, env: { ...process.env } }, (err, stdout) => {
                    resolve(err ? '' : (stdout || '').trim());
                });
            });
        };

        // 1. which / where 로 PATH에 있는 python 탐색
        const isWin = process.platform === 'win32';
        const whichCmd = isWin ? 'where' : 'which -a';
        const pythonNames = isWin
            ? ['python', 'python3']
            : ['python3', 'python'];

        const whichPromises = pythonNames.map(async (name) => {
            const output = await execPromise(`${whichCmd} ${name} 2>/dev/null`);
            if (output) {
                for (const line of output.split(/\r?\n/)) {
                    const trimmed = line.trim();
                    if (trimmed) addIfValid(trimmed, 'PATH');
                }
            }
        });
        await Promise.all(whichPromises);

        // 2. Conda 환경 탐색
        const condaOutput = await execPromise('conda env list --json 2>/dev/null');
        if (condaOutput) {
            try {
                const condaData = JSON.parse(condaOutput);
                if (Array.isArray(condaData.envs)) {
                    for (const envPath of condaData.envs) {
                        const pythonBin = isWin
                            ? path.join(envPath, 'python.exe')
                            : path.join(envPath, 'bin', 'python');
                        const envName = path.basename(envPath);
                        addIfValid(pythonBin, `conda: ${envName}`);
                    }
                }
            } catch (_) { /* ignore JSON parse error */ }
        }

        // 3. Pyenv 환경 탐색
        const pyenvRoot = process.env.PYENV_ROOT || path.join(process.env.HOME || '', '.pyenv');
        const pyenvVersionsDir = path.join(pyenvRoot, 'versions');
        try {
            if (fs.existsSync(pyenvVersionsDir)) {
                const versions = fs.readdirSync(pyenvVersionsDir);
                for (const ver of versions) {
                    const pythonBin = path.join(pyenvVersionsDir, ver, 'bin', 'python');
                    addIfValid(pythonBin, `pyenv: ${ver}`);
                }
            }
        } catch (_) { /* ignore */ }

        // 4. 워크스페이스 내 venv / .venv 탐색
        const wizRoot = this.getWizRoot();
        if (wizRoot) {
            const venvDirs = ['venv', '.venv', 'env', '.env'];
            for (const venvDir of venvDirs) {
                const pythonBin = isWin
                    ? path.join(wizRoot, venvDir, 'Scripts', 'python.exe')
                    : path.join(wizRoot, venvDir, 'bin', 'python');
                addIfValid(pythonBin, `venv: ${venvDir}`);
            }
        }

        // 5. 일반적인 시스템 경로 탐색
        if (!isWin) {
            const commonPaths = [
                '/usr/bin/python3',
                '/usr/bin/python',
                '/usr/local/bin/python3',
                '/usr/local/bin/python',
            ];
            for (const p of commonPaths) {
                addIfValid(p, 'system');
            }
        }

        // 결과 정리 (버전 정보 가져오기)
        const results = [];
        const versionPromises = [];

        for (const [pythonPath, info] of found.entries()) {
            versionPromises.push(
                execPromise(`"${pythonPath}" --version 2>&1`)
                    .then((ver) => {
                        const version = (ver || '').replace(/^Python\s*/i, '').trim();
                        const hasWiz = this._getWizExecutableFromInterpreter(pythonPath) ? ' $(check) wiz' : '';
                        results.push({
                            pythonPath,
                            label: `$(symbol-event) ${version || 'Python'}${hasWiz}`,
                            detail: pythonPath,
                            description: info.source
                        });
                    })
                    .catch(() => {
                        results.push({
                            pythonPath,
                            label: '$(symbol-event) Python',
                            detail: pythonPath,
                            description: info.source
                        });
                    })
            );
        }

        await Promise.all(versionPromises);

        // wiz가 있는 환경을 먼저 표시
        results.sort((a, b) => {
            const aHasWiz = a.label.includes('wiz') ? 0 : 1;
            const bHasWiz = b.label.includes('wiz') ? 0 : 1;
            return aHasWiz - bHasWiz;
        });

        return results;
    }

    async _selectInterpreterByPath() {
        const wizRoot = this.getWizRoot();

        // 사용 가능한 Python 환경 자동 탐색
        const interpreters = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Python 환경을 검색하고 있습니다...' },
            () => this._discoverPythonInterpreters()
        );

        // QuickPick 항목 구성
        const items = [];

        if (interpreters.length > 0) {
            items.push({ label: '검색된 Python 환경', kind: vscode.QuickPickItemKind.Separator });
            items.push(...interpreters);
        }

        items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
        items.push({
            label: '$(edit) 직접 경로 입력...',
            detail: 'Python 실행 파일의 절대 경로를 직접 입력합니다',
            pythonPath: '__manual__'
        });

        const selected = await vscode.window.showQuickPick(items, {
            title: 'Wiz 빌드용 Python 환경 선택',
            placeHolder: interpreters.length > 0
                ? 'Python 환경을 선택하세요 ($(check) wiz = wiz 설치됨)'
                : 'Python 환경을 찾지 못했습니다. 직접 경로를 입력하세요.',
            matchOnDetail: true,
            matchOnDescription: true
        });

        if (!selected) return null;

        // 직접 입력 선택
        if (selected.pythonPath === '__manual__') {
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

        // 리스트에서 선택
        const selectedPath = selected.pythonPath;
        await this._writeConfiguredPythonPath(selectedPath);
        return selectedPath;
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
     * 빌드 실행 (디바운스 적용)
     * @param {boolean} [clean=false] - Clean 빌드 여부
     * @returns {boolean} 빌드 시작 예약 성공 여부
     */
    triggerBuild(clean = false) {
        // 기존 대기 중인 빌드 취소
        if (this._buildTimer) {
            clearTimeout(this._buildTimer);
            this._buildTimer = null;
        }

        // 500ms 후 빌드 실행 (연속 저장 시 마지막 요청만 수행)
        this._buildTimer = setTimeout(() => {
            this._execTriggerBuild(clean);
        }, 500);

        return true;
    }

    /**
     * 실제 빌드 로직 실행
     * @private
     */
    _execTriggerBuild(clean) {
        // 이전 빌드 프로세스가 실행 중이면 종료
        if (this.buildProcess) {
            try {
                process.kill(this.buildProcess.pid); // child_process.kill()은 때때로 동작하지 않을 수 있음
            } catch (e) {
                // ignore
            }
            this.buildProcess = null;
        }

        this._triggerBuildInternal(clean).catch((err) => {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Build error: ${err.message}`);
            this.buildProcess = null;
        });
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
     * 상위 메뉴: Wiz 빌드 / Python 환경 선택
     * @returns {Promise<boolean>} 성공 여부
     */
    async showBuildMenu() {
        const menuOptions = [
            { label: '$(tools) Wiz 빌드', description: '프로젝트 빌드 실행', value: 'build' },
            { label: '$(symbol-event) Python 가상환경 선택', description: '빌드에 사용할 Python 환경 변경', value: 'python' },
            { label: '$(package) npm 패키지 관리', description: '패키지 설치, 업그레이드, 삭제', value: 'npm' },
            { label: '$(symbol-method) pip 패키지 관리', description: 'Python 패키지 설치, 업그레이드, 삭제', value: 'pip' }
        ];

        const selected = await vscode.window.showQuickPick(menuOptions, {
            title: 'Wiz 설정',
            placeHolder: '실행할 작업을 선택하세요'
        });

        if (!selected) return false;

        if (selected.value === 'python') {
            return this.selectBuildPythonInterpreter();
        }

        if (selected.value === 'npm') {
            await vscode.commands.executeCommand('wizExplorer.openNpmManager');
            return true;
        }

        if (selected.value === 'pip') {
            await vscode.commands.executeCommand('wizExplorer.openPipManager');
            return true;
        }

        return this._showBuildTypeMenu();
    }

    /**
     * 빌드 타입 선택 후 실행 (Normal / Clean)
     * @returns {Promise<boolean>} 성공 여부
     * @private
     */
    async _showBuildTypeMenu() {
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
