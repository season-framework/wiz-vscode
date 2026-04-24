/**
 * Wiz VSCode Extension (Refactored)
 * 확장 프로그램 진입점
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const FileExplorerProvider = require('./explorer/fileExplorerProvider');
const CategoryViewProvider = require('./explorer/categoryViewProvider');
const { SettingsCategory, TaskCategory, InstructionCategory } = require('./explorer/models/categoryHandlers');
const AppEditorProvider = require('./editor/appEditorProvider');
const AppContextListener = require('./editor/appContextListener');
const WizFileSystemProvider = require('./editor/wizFileSystemProvider');
const NpmEditor = require('./editor/editors/npmEditor');
const PipEditor = require('./editor/editors/pipEditor');
const TodoEditor = require('./editor/editors/todoEditor');
const TodoViewerEditor = require('./editor/editors/todoViewerEditor');
const MemoViewerEditor = require('./editor/editors/memoViewerEditor');
const WorkedReviewEditor = require('./editor/editors/workedReviewEditor');
const MarkdownViewerEditor = require('./editor/editors/markdownViewerEditor');
const { WizPathUtils } = require('./core');
const { SourceManager, PackageManager, ProjectManager, FileManager, BuildManager, McpManager, NavigationManager } = require('./services');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // ==================== Core Providers ====================
    const appEditorProvider = new AppEditorProvider(context);
    const appContextListener = new AppContextListener(context);
    const fileExplorerProvider = new FileExplorerProvider(
        undefined,
        context.extensionPath,
        undefined,
        context.extension.packageJSON?.version || 'unknown'
    );

    // Register Wiz File System
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider('wiz', new WizFileSystemProvider(), { 
            isCaseSensitive: true 
        })
    );

    // ==================== Category View Providers ====================
    const infoCategory = new SettingsCategory(fileExplorerProvider);
    const taskCategory = new TaskCategory(fileExplorerProvider);
    const instructionCategory = new InstructionCategory(fileExplorerProvider);

    const infoProvider = new CategoryViewProvider(infoCategory, fileExplorerProvider);
    const taskProvider = new CategoryViewProvider(taskCategory, fileExplorerProvider);
    const instructionProvider = new CategoryViewProvider(instructionCategory, fileExplorerProvider);

    // Register Webview Serializer for Info Tab Split/Restore
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer('wizAppInfo', {
            async deserializeWebviewPanel(webviewPanel, state) {
                if (state && state.appPath) {
                    appEditorProvider.reviveInfoEditor(webviewPanel, state.appPath, appContextListener);
                }
            }
        })
    );

    // ==================== Workspace State ====================
    let workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let currentProject = 'main';

    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            updateProjectRoot();
        })
    );

    // ==================== Service Managers ====================
    const buildManager = new BuildManager({
        getWizRoot: () => workspaceRoot,
        getCurrentProject: () => currentProject
    });

    const mcpManager = new McpManager({
        extensionPath: context.extensionPath,
        getWizRoot: () => workspaceRoot,
        getCurrentProject: () => currentProject,
        onStateChange: (state) => {
            fileExplorerProvider.mcpConfigExists = state.mcpConfigExists;
            fileExplorerProvider.mcpServerRunning = state.mcpServerRunning;
            fileExplorerProvider.refresh();
        }
    });

    const sourceManager = new SourceManager({
        workspaceRoot: fileExplorerProvider.workspaceRoot,
        onRefresh: () => fileExplorerProvider.refresh()
    });
    
    const packageManager = new PackageManager({
        workspaceRoot: fileExplorerProvider.workspaceRoot,
        wizRoot: fileExplorerProvider.wizRoot,
        currentProject: currentProject,
        onRefresh: () => fileExplorerProvider.refresh(),
        outputChannel: buildManager.getOutputChannel()
    });

    const projectManager = new ProjectManager({
        wizRoot: workspaceRoot,
        onRefresh: () => fileExplorerProvider.refresh(),
        outputChannel: buildManager.getOutputChannel()
    });

    const fileManager = new FileManager({
        onRefresh: () => {
            fileExplorerProvider.refresh();
        },
        getWorkspaceRoot: () => fileExplorerProvider.workspaceRoot
    });

    const navigationManager = new NavigationManager({
        getWorkspaceRoot: () => fileExplorerProvider.workspaceRoot,
        openInfoEditor: (appPath) => appEditorProvider.openInfoEditor(appPath, appContextListener),
        getActiveEditor: () => appEditorProvider.activeEditor,
        closeWebview: () => appEditorProvider.closeWebview?.() || appEditorProvider.currentWebviewPanel?.dispose()
    });

    // Inject build trigger to AppEditorProvider
    appEditorProvider.onFileSaved = () => {
        if (!buildManager.isAutoBuildEnabled()) return;
        buildManager.triggerBuild(false);
    };

    // 파일 저장 시 자동 빌드 이벤트 등록 (BuildManager에 위임)
    buildManager.registerSaveWatcher(context);

    function resolveProjectNameCase(wizRoot, projectName) {
        if (!wizRoot || !projectName) return projectName;
        try {
            const projectBase = path.join(wizRoot, 'project');
            if (!require('fs').existsSync(projectBase)) return projectName;
            const entries = require('fs').readdirSync(projectBase, { withFileTypes: true });
            const matched = entries.find(
                e => e.isDirectory() && e.name.toLowerCase() === projectName.toLowerCase()
            );
            return matched ? matched.name : projectName;
        } catch (e) {
            return projectName;
        }
    }

    // ==================== Workspace State Sync ====================
    function updateProjectRoot() {
        if (!workspaceRoot) {
            fileExplorerProvider.workspaceRoot = undefined;
            fileExplorerProvider.wizRoot = undefined;
            fileExplorerProvider.isWizProject = false;
            fileExplorerProvider.currentProjectName = currentProject;
            fileExplorerProvider.refresh();
            return;
        }

        // WIZ 프로젝트 여부 판별: project/ 폴더가 존재하는지 확인
        const projectDir = path.join(workspaceRoot, 'project');
        const isWiz = fs.existsSync(projectDir);

        if (isWiz) {
            const displayProjectName = resolveProjectNameCase(workspaceRoot, currentProject);
            const projectPath = path.join(workspaceRoot, 'project', displayProjectName);
            fileExplorerProvider.workspaceRoot = projectPath;
            fileExplorerProvider.wizRoot = workspaceRoot;
            fileExplorerProvider.isWizProject = true;
            fileExplorerProvider.currentProjectName = displayProjectName;
            fileExplorerProvider.refresh();

            if (treeView) {
                treeView.title = displayProjectName;
            }

            vscode.commands.executeCommand('setContext', 'wiz.isWizProject', true);
        } else {
            // 비-WIZ 프로젝트: 워크스페이스 폴더 자체를 사용
            fileExplorerProvider.workspaceRoot = workspaceRoot;
            fileExplorerProvider.wizRoot = workspaceRoot;
            fileExplorerProvider.isWizProject = false;
            fileExplorerProvider.currentProjectName = '';
            fileExplorerProvider.refresh();

            if (treeView) {
                treeView.title = path.basename(workspaceRoot);
            }

            vscode.commands.executeCommand('setContext', 'wiz.isWizProject', false);
        }

        // Service managers 상태 동기화
        sourceManager.workspaceRoot = fileExplorerProvider.workspaceRoot;
        packageManager.workspaceRoot = fileExplorerProvider.workspaceRoot;
        packageManager.wizRoot = fileExplorerProvider.wizRoot;
        packageManager.currentProject = currentProject;
        projectManager.wizRoot = workspaceRoot;

        // 프로젝트 전환 시 편집 추적 초기화
        buildManager.clearEditedDocuments();

        // MCP 서버와 상태 동기화 (.vscode/.wiz-state.json)
        mcpManager.writeState();
    }

    // ==================== MCP State File Watcher ====================
    // MCP에서 프로젝트 스위칭 시 .wiz-state.json이 변경되면 UI 동기화
    let stateFileWatcher = null;
    let stateWatcherDebounce = null;

    function setupStateFileWatcher() {
        if (stateFileWatcher) {
            stateFileWatcher.dispose();
            stateFileWatcher = null;
        }
        if (!workspaceRoot) return;

        const statePattern = new vscode.RelativePattern(workspaceRoot, '.vscode/.wiz-state.json');
        stateFileWatcher = vscode.workspace.createFileSystemWatcher(statePattern);

        const handleStateChange = () => {
            if (stateWatcherDebounce) clearTimeout(stateWatcherDebounce);
            stateWatcherDebounce = setTimeout(() => {
                stateWatcherDebounce = null;
                try {
                    const statePath = path.join(workspaceRoot, '.vscode', '.wiz-state.json');
                    if (!fs.existsSync(statePath)) return;
                    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                    if (!raw.sessions) return;

                    // 가장 최근 세션에서 currentProject 읽기
                    let latestProject = null;
                    let latestTime = -1;
                    for (const session of Object.values(raw.sessions)) {
                        if ((session.lastUsed || 0) > latestTime) {
                            latestTime = session.lastUsed || 0;
                            latestProject = session.currentProject;
                        }
                    }

                    if (latestProject && latestProject !== currentProject) {
                        currentProject = latestProject;
                        updateProjectRoot();
                    }
                } catch (e) { /* ignore parse errors */ }
            }, 500);
        };

        stateFileWatcher.onDidChange(handleStateChange);
        stateFileWatcher.onDidCreate(handleStateChange);

        context.subscriptions.push(stateFileWatcher);
    }

    setupStateFileWatcher();

    // 워크스페이스 변경 시 watcher 재설정
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            setupStateFileWatcher();
        })
    );

    // ==================== Tree View ====================
    // 트리 뷰 생성 전에 초기 컨텍스트 설정 (기본 비-WIZ 상태)
    vscode.commands.executeCommand('setContext', 'wiz.isWizProject', false);

    const WizDragAndDropController = require('./explorer/wizDragAndDropController');
    const dragAndDropController = new WizDragAndDropController(fileExplorerProvider);
    
    const treeView = vscode.window.createTreeView('wizExplorer', {
        treeDataProvider: fileExplorerProvider,
        showCollapseAll: true,
        canSelectMany: true,
        dragAndDropController: dragAndDropController
    });
    context.subscriptions.push(treeView);

    // Sub-views: Info, Task, Instruction
    const infoView = vscode.window.createTreeView('wizInfo', {
        treeDataProvider: infoProvider
    });
    const taskView = vscode.window.createTreeView('wizTask', {
        treeDataProvider: taskProvider,
        showCollapseAll: true,
        canSelectMany: true
    });
    const instructionView = vscode.window.createTreeView('wizInstruction', {
        treeDataProvider: instructionProvider,
        showCollapseAll: true,
        canSelectMany: true
    });
    context.subscriptions.push(infoView, taskView, instructionView);

    updateProjectRoot();

    // 최신 버전 확인 (GitHub tags에서 조회)
    (async () => {
        try {
            const https = require('https');
            const data = await new Promise((resolve, reject) => {
                const req = https.get('https://api.github.com/repos/season-framework/wiz-vscode/tags?per_page=1', {
                    headers: { 'User-Agent': 'wiz-vscode-extension' }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => resolve(body));
                });
                req.on('error', reject);
                req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
            });
            const tags = JSON.parse(data);
            if (tags.length > 0) {
                const latest = tags[0].name.replace(/^v/, '');
                fileExplorerProvider.latestVersion = latest;
                fileExplorerProvider.refresh();
            }
        } catch (e) { /* 네트워크 오류 무시 */ }
    })();

    // Auto-reveal on file change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (editor && treeView.visible) {
                 // Skip auto-reveal during file save/build process to prevent loops
                 // or if the editor is not relevant
                 if (editor.document.isDirty) return;

                const uri = editor.document.uri;
                let filePath;

                if (uri.scheme === 'file') {
                    filePath = uri.fsPath;
                } else if (uri.scheme === 'wiz') {
                    filePath = WizPathUtils.getRealPathFromUri(uri);
                }

                if (filePath) {
                    // Skip auto-reveal for files outside the current project tree
                    // (.github, .vscode, etc. are under wizRoot, not workspaceRoot)
                    const projectRoot = fileExplorerProvider.workspaceRoot;
                    if (!projectRoot || !filePath.startsWith(projectRoot + path.sep)) return;

                    try {
                        // Prevent infinite loop if update takes too long
                        const item = await Promise.race([
                            fileExplorerProvider.findItem(filePath),
                            new Promise(resolve => setTimeout(() => resolve(null), 500))
                        ]);
                        
                        if (item) {
                            // Check if item still exists before revealing
                            if (fs.existsSync(item.resourceUri.fsPath)) {
                                treeView.reveal(item, { select: true, focus: false, expand: true });
                            }
                        }
                    } catch (e) {
                        // Ignore reveal errors
                    }
                }
            }
        })
    );


    // ==================== Commands Registration ====================
    const commands = [
        // Core commands
        ['wizExplorer.refresh', () => fileExplorerProvider.refresh()],
        ['wizCopilot.refresh', () => fileExplorerProvider.refresh()],
        ['wizCopilot.generateTaskInstruction', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            const items = [
                { label: '$(tasklist) 작업 관리 인스트럭션 적용', description: 'Task 기반 작업 관리 규칙을 인스트럭션에 반영합니다', action: 'taskInstruction' },
                { label: '$(search) 아키텍처 분석', description: '프로젝트 구조를 분석하여 가이드라인 문서를 생성합니다', action: 'architecture' }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '수행할 기능을 선택하세요'
            });

            if (!selected) return;

            if (selected.action === 'taskInstruction') {
                const githubPath = path.join(workspaceRoot, '.github');
                const instructionPath = path.join(githubPath, 'copilot-instructions.md');

                // 기존 인스트럭션 파일에 이미 반영되어 있는지 확인
                if (fs.existsSync(instructionPath)) {
                    const existing = fs.readFileSync(instructionPath, 'utf8');
                    if (existing.includes('Task 기반 작업 관리')) {
                        const answer = await vscode.window.showWarningMessage(
                            'Task 기반 작업 관리 인스트럭션이 이미 반영되어 있습니다.\n다시 적용하시겠습니까?',
                            { modal: true },
                            '다시 적용'
                        );
                        if (answer !== '다시 적용') return;
                    }
                }

                // Copilot 채팅에 보낼 프롬프트 구성
                const prompt = [
                    `아래 "Task 기반 작업 관리" 인스트럭션을 \`${path.relative(workspaceRoot, instructionPath)}\` 파일에 반영해줘.`,
                    '기존 파일이 있으면 내용을 유지하면서 인스트럭션을 추가/업데이트하고, 없으면 새로 생성해줘.',
                    '',
                    '## 반영할 인스트럭션',
                    '',
                    '### Forced Instruction (파일 상단, 우선순위 높은 위치에 배치)',
                    '',
                    '> **Task 기반 작업 관리**: 사용자가 **"작업 수행해줘"**, **"todo 작업 진행해줘"** 등으로 작업을 지시하면, `.github/task/todo.md`를 읽어 순서대로 수행한다. 상세 규칙은 하단 "Task 기반 작업 관리" 섹션을 참조한다.',
                    '',
                    '### Refer Instruction (파일 하단에 상세 규칙 섹션으로 배치)',
                    '',
                    '## Task 기반 작업 관리',
                    '',
                    '사용자가 **"작업 수행해줘"**, **"todo 작업 진행해줘"** 등으로 작업을 지시하면, `.github/task/todo.md`를 읽어 정의된 작업을 순서대로 수행한다.',
                    '',
                    '> ⚠️ **TODO 파일 경로 고정**: `{WIZ_ROOT}/.github/task/todo.md`에 작성한다. 프로젝트 소스 내(`project/{name}/`)나 다른 위치에 생성하지 않는다.',
                    '',
                    '> ⚠️ **"TODO 작성해줘" 명령**: 사용자의 요구사항·설계 문서를 분석하여 **todo.md에 신규 작업 항목만 등록**하고, 실제 개발 작업은 수행하지 않는다.',
                    '',
                    '### 디렉토리 구조',
                    '',
                    '```',
                    '.github/task/',
                    '├── todo.md              # 작업 목록 (할 일)',
                    '├── worked/              # 완료된 작업 아카이브',
                    '│   └── FN-20260222-0001.md',
                    '└── reviewed/            # 리뷰 완료 후 이동된 아카이브',
                    '    └── FN-20260222-0001.md',
                    '```',
                    '',
                    '### todo.md 형식',
                    '',
                    '작업은 `#` 헤딩과 **작업 번호** `FN-{YYYYMMDD}-{NNNN}`으로 구분한다.',
                    '',
                    '```markdown',
                    '# FN-20260222-0001: Endpoint 설정 / Variables 탭 관련',
                    '- endpoint / variables 탭에서 api parameters 설정에서 actions는 고정된 값이니까 토글 형태로 선택하는 UI로 구현',
                    '',
                    '# FN-20260222-0002: API Spec & Test 탭 관련',
                    '- API Spec & Test 화면에서 실제 API로 연결해서 결과 확인하도록 구현',
                    '```',
                    '',
                    '### 작업 수행 흐름',
                    '',
                    '1. **todo.md 읽기**: 작업 목록 파악',
                    '2. **작업 수행**: 번호 순서대로 (또는 사용자가 특정 번호 지정 시 해당 작업만) 수행. 개발 원칙 준수.',
                    '3. **각 Task 완료 즉시 정리** (다음 Task로 넘어가기 전에 반드시 수행):',
                    '   1. **Devlog 작성**: Devlog 규칙에 따라 행 추가 + 상세 파일 생성',
                    '   2. **worked 아카이브 생성**: `.github/task/worked/{작업번호}.md`에 아래 형식으로 기록',
                    '   3. **todo.md 정리**: 완료된 작업 항목을 `todo.md`에서 삭제',
                    '   4. **더미 템플릿 유지**: 모든 항목 삭제 시, 마지막 번호의 다음 순번으로 더미 템플릿을 남긴다.',
                    '',
                    '> ⚠️ **즉시 정리 원칙**: 하나의 Task(FN-번호) 완료 후, **반드시 위 3-1 ~ 3-4를 모두 수행한 뒤** 다음 Task로 넘어간다. 여러 Task를 먼저 수행하고 나중에 몰아서 정리하는 것은 **금지**한다.',
                    '',
                    '### worked 아카이브 형식',
                    '',
                    '```markdown',
                    '# {작업번호}: {작업 제목}',
                    '',
                    '## 작업 지시 원문',
                    '{todo.md에 있던 원본 내용 그대로 복사 — 요약·정리하지 않고 원문 보존}',
                    '',
                    '## 수행 내역 요약',
                    '{무엇을 어떻게 구현했는지 간결하게 요약}',
                    '',
                    '## 관련 Devlog',
                    '- **날짜**: {YYYY-MM-DD}',
                    '- **Devlog ID**: {NNN}',
                    '- **상세 파일**: `devlog/{YYYY-MM-DD}/{NNN}-{slug}.md`',
                    '```',
                    '',
                    '### todo 항목 추가 규칙',
                    '',
                    '1. 기존 작업 번호 확인',
                    '2. `FN-{YYYYMMDD}-{NNNN}` 형식으로 생성 (해당 날짜의 마지막 번호 + 1)',
                    '3. `# FN-{번호}: {제목}` 헤딩과 하위 항목으로 추가',
                    '',
                    '### 특정 작업 지정 실행',
                    '',
                    '- "FN-20260222-0001 작업 수행해줘" → 해당 번호만 수행',
                    '- "todo 1번 작업 진행해줘" → todo.md의 첫 번째 항목 수행',
                    '- 번호 미지정 시 → 첫 번째 항목부터 순서대로 (한 번에 하나씩)',
                    '',
                    '### 리뷰 정리 및 TODO 생성',
                    '',
                    '사용자가 **"리뷰 정리해줘"** 등으로 요청하면:',
                    '',
                    '1. **worked 폴더 스캔**: `.github/task/worked/` 내 모든 `.md` 파일을 읽는다.',
                    '2. **`# Review` 섹션 확인**: 있는 파일만 처리, 없는 파일은 건드리지 않는다.',
                    '3. **TODO 항목 생성**: Review 내용을 정리하여 todo.md에 새 작업 항목으로 추가한다.',
                    '4. **reviewed 폴더로 이동**: Review 섹션이 있던 worked 파일을 `.github/task/reviewed/`로 이동한다.',
                    '5. **결과 보고**: 처리된 파일 수, 생성된 TODO 항목 수, 스킵된 파일 수를 알린다.',
                ].join('\n');

                try {
                    const confirm = await vscode.window.showWarningMessage(
                        'Copilot Chat으로 DevOps 가이드 생성을 요청하시겠습니까?',
                        { modal: true }, '보내기'
                    );
                    if (confirm !== '보내기') return;

                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: prompt,
                        mode: 'agent'
                    });
                } catch (e) {
                    vscode.window.showWarningMessage(
                        'Copilot Chat을 열 수 없습니다. GitHub Copilot Chat 확장이 설치되어 있는지 확인해주세요.',
                        '확인'
                    );
                }
            } else if (selected.action === 'architecture') {
                try {
                    const confirm = await vscode.window.showWarningMessage(
                        'Copilot Chat으로 아키텍처 분석을 요청하시겠습니까?',
                        { modal: true }, '보내기'
                    );
                    if (confirm !== '보내기') return;

                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: '현재 프로젝트에 대해서 분석해서 custom 인스트럭션에 이 시스템을 고도화/유지보수하기 위한 가이드라인 및 참고할만한 시스템/서비스 아키텍처 문서들을 정리해줘. 커스텀 인스트럭션에는 간략한 수준으로 해야할 일에 따른 네비게이션 역할을 하는 내용만 작성해주고, 상세 문서는 별도로 만들어줘.',
                        mode: 'agent'
                    });
                } catch (e) {
                    vscode.window.showWarningMessage(
                        'Copilot Chat을 열 수 없습니다. GitHub Copilot Chat 확장이 설치되어 있는지 확인해주세요.',
                        '확인'
                    );
                }
            }
        }],
        ['wizCopilot.todoWizard', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }
            const taskPath = path.join(workspaceRoot, '.github', 'task');
            if (!fs.existsSync(taskPath)) {
                fs.mkdirSync(taskPath, { recursive: true });
            }
            const todoEditor = new TodoEditor(context, taskPath);
            await todoEditor.open();  // Singleton: reveals existing tab if already open
        }],
        ['wizCopilot.reviewWizard', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }
            const workedPath = path.join(workspaceRoot, '.github', 'task', 'worked');
            if (!fs.existsSync(workedPath)) {
                fs.mkdirSync(workedPath, { recursive: true });
            }
            await WorkedReviewEditor.openOrCreate(context, workedPath);
        }],
        ['wizCopilot.runTask', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }
            const confirm = await vscode.window.showWarningMessage(
                'Copilot Chat으로 작업 실행을 요청하시겠습니까?',
                { modal: true }, '실행'
            );
            if (confirm !== '실행') return;

            const todoPath = path.join(workspaceRoot, '.github', 'task', 'todo.md');
            try {
                await vscode.commands.executeCommand('workbench.action.chat.open', {
                    query: '작업 수행해줘',
                    mode: 'agent',
                    attachFiles: [vscode.Uri.file(todoPath)]
                });
            } catch (e) {
                vscode.window.showWarningMessage(
                    'Copilot Chat을 열 수 없습니다. GitHub Copilot Chat 확장이 설치되어 있는지 확인해주세요.',
                    '확인'
                );
            }
        }],
        ['wizCopilot.taskAction', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            const items = [
                { label: '$(edit) 작업 생성', description: 'TODO 에디터를 열어 새 작업을 생성합니다', action: 'create' },
                { label: '$(wand) 리뷰 정리', description: 'worked 파일의 리뷰를 정리합니다', action: 'review' },
                { label: '$(play) 작업 실행', description: 'Copilot Chat에서 작업을 실행합니다', action: 'run' }
            ];

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '수행할 작업을 선택하세요'
            });

            if (!selected) return;

            switch (selected.action) {
                case 'create': {
                    const taskPath = path.join(workspaceRoot, '.github', 'task');
                    if (!fs.existsSync(taskPath)) {
                        fs.mkdirSync(taskPath, { recursive: true });
                    }
                    const todoEditor = new TodoEditor(context, taskPath);
                    await todoEditor.open();
                    break;
                }
                case 'review': {
                    const workedPath = path.join(workspaceRoot, '.github', 'task', 'worked');
                    if (!fs.existsSync(workedPath)) {
                        fs.mkdirSync(workedPath, { recursive: true });
                    }
                    await WorkedReviewEditor.openOrCreate(context, workedPath);
                    break;
                }
                case 'run': {
                    const confirm = await vscode.window.showWarningMessage(
                        'Copilot Chat으로 작업 실행을 요청하시겠습니까?',
                        { modal: true }, '실행'
                    );
                    if (confirm !== '실행') break;

                    const todoPath = path.join(workspaceRoot, '.github', 'task', 'todo.md');
                    try {
                        await vscode.commands.executeCommand('workbench.action.chat.open', {
                            query: '작업 수행해줘',
                            mode: 'agent',
                            attachFiles: [vscode.Uri.file(todoPath)]
                        });
                    } catch (e) {
                        vscode.window.showWarningMessage(
                            'Copilot Chat을 열 수 없습니다. GitHub Copilot Chat 확장이 설치되어 있는지 확인해주세요.',
                            '확인'
                        );
                    }
                    break;
                }
            }
        }],
        ['wizCopilot.openTodoInDefaultEditor', async (resource) => {
            if (!resource || !resource.resourceUri) return;
            try {
                await vscode.commands.executeCommand('vscode.open', resource.resourceUri);
            } catch (e) {
                vscode.window.showErrorMessage(`파일 열기 실패: ${e.message}`);
            }
        }],
        ['wizExplorer.openAppEditor', (appPath, groupType) => appEditorProvider.openEditor(appPath, groupType)],
        ['wizExplorer.openPortalInfo', (portalJsonPath) => appEditorProvider.openPortalInfoEditor(portalJsonPath)],
        ['wizExplorer.updateExtension', async () => {
            const latest = fileExplorerProvider.latestVersion;
            const current = context.extension.packageJSON?.version || '0.0.0';
            if (!latest) {
                vscode.window.showInformationMessage('버전 정보를 확인할 수 없습니다.');
                return;
            }
            const pa = latest.split('.').map(Number);
            const pb = current.split('.').map(Number);
            let hasUpdate = false;
            for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
                if ((pa[i] || 0) > (pb[i] || 0)) { hasUpdate = true; break; }
                if ((pa[i] || 0) < (pb[i] || 0)) break;
            }
            if (!hasUpdate) {
                vscode.window.showInformationMessage(`현재 v${current}은 최신 버전입니다.`);
                return;
            }
            const pick = await vscode.window.showInformationMessage(
                `새 버전 v${latest}이 있습니다 (현재 v${current}). 업데이트하시겠습니까?`,
                '업데이트'
            );
            if (pick === '업데이트') {
                const vsixUrl = `https://github.com/season-framework/wiz-vscode/releases/download/v${latest}/wiz-vscode-${latest}.vsix`;
                await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: `Wiz v${latest} 다운로드 중...`, cancellable: false },
                    async (progress) => {
                        try {
                            const https = require('https');
                            const os = require('os');
                            const tmpPath = require('path').join(os.tmpdir(), `wiz-vscode-${latest}.vsix`);

                            // GitHub releases → 302 redirect 처리 포함 다운로드
                            await new Promise((resolve, reject) => {
                                const download = (url) => {
                                    https.get(url, { headers: { 'User-Agent': 'wiz-vscode-extension' } }, (res) => {
                                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                            download(res.headers.location);
                                            return;
                                        }
                                        if (res.statusCode !== 200) {
                                            reject(new Error(`HTTP ${res.statusCode}`));
                                            return;
                                        }
                                        const fileStream = require('fs').createWriteStream(tmpPath);
                                        res.pipe(fileStream);
                                        fileStream.on('finish', () => { fileStream.close(); resolve(); });
                                        fileStream.on('error', reject);
                                    }).on('error', reject);
                                };
                                download(vsixUrl);
                            });

                            progress.report({ message: '설치 중...' });
                            await vscode.commands.executeCommand(
                                'workbench.extensions.installExtension',
                                vscode.Uri.file(tmpPath)
                            );

                            // 임시 파일 정리
                            try { require('fs').unlinkSync(tmpPath); } catch (e) { /* skip */ }

                            const reload = await vscode.window.showInformationMessage(
                                '업데이트가 완료되었습니다. 다시 로드하시겠습니까?',
                                '다시 로드'
                            );
                            if (reload === '다시 로드') {
                                await vscode.commands.executeCommand('workbench.action.reloadWindow');
                            }
                        } catch (err) {
                            vscode.window.showErrorMessage(`업데이트 실패: ${err.message}`);
                        }
                    }
                );
            }
        }],

        // MCP Server commands
        ['wizExplorer.startMcpServer', () => mcpManager.start()],
        ['wizExplorer.stopMcpServer', () => mcpManager.stop()],
        ['wizExplorer.showMcpConfig', () => mcpManager.showConfig()],
        ['wizExplorer.createMcpConfig', () => mcpManager.createConfig()],
        ['wizExplorer.mcpConfigMenu', async () => {
            const mcpJsonPath = mcpManager._getMcpJsonPath();
            const exists = mcpJsonPath && require('fs').existsSync(mcpJsonPath);

            if (!exists) {
                await mcpManager.createConfig();
                return;
            }

            const pick = await vscode.window.showQuickPick(
                [
                    { label: '$(file-code) 설정 보기', description: '.vscode/mcp.json 열기', id: 'show' },
                    { label: '$(refresh) 초기화 하기', description: 'MCP 서버 중지 및 설정 재생성', id: 'reset' }
                ],
                { title: 'MCP Configuration', placeHolder: '원하는 작업을 선택하세요' }
            );
            if (!pick) return;

            if (pick.id === 'show') {
                await mcpManager.showConfig();
            } else if (pick.id === 'reset') {
                await mcpManager.resetConfig();
            }
        }],
        
        // Git에서 .github 불러오기
        ['wizExplorer.importGithubFromGit', async () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            const gitUrl = await vscode.window.showInputBox({
                title: 'Git에서 .github 불러오기',
                prompt: 'Git 레포지토리 주소를 입력하세요',
                placeHolder: 'https://github.com/user/repo.git',
                ignoreFocusOut: true
            });
            if (!gitUrl) return;

            const githubPath = path.join(workspaceRoot, '.github');

            const confirm = await vscode.window.showWarningMessage(
                `"${gitUrl}" 레포의 내용을 .github 디렉토리에 병합합니다. 동일 이름의 파일은 덮어씁니다. 계속하시겠습니까?`,
                { modal: true },
                '확인'
            );
            if (confirm !== '확인') return;

            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: '.github 불러오는 중...' },
                async () => {
                    const cp = require('child_process');
                    const util = require('util');
                    const exec = util.promisify(cp.exec);
                    const os = require('os');
                    const tmpDir = path.join(os.tmpdir(), `wiz_git_import_${Date.now()}`);
                    try {
                        // 1. tmp 폴더에 clone
                        await exec(`git clone "${gitUrl}" "${tmpDir}"`);
                        // 2. .github 폴더 생성
                        if (!fs.existsSync(githubPath)) {
                            fs.mkdirSync(githubPath, { recursive: true });
                        }
                        // 3. clone된 레포 내용을 .github에 복사 (기존 파일 유지, 동일 파일만 덮어쓰기)
                        await exec(`cp -R "${tmpDir}/"* "${githubPath}/"`);
                        // 4. 복사된 .git 디렉토리 제거
                        const dotGitPath = path.join(githubPath, '.git');
                        if (fs.existsSync(dotGitPath)) {
                            await exec(`rm -rf "${dotGitPath}"`);
                        }
                        // 5. tmp 폴더 정리
                        await exec(`rm -rf "${tmpDir}"`);
                        vscode.window.showInformationMessage('.github 디렉토리를 성공적으로 불러왔습니다.');
                        fileExplorerProvider.refresh();
                    } catch (err) {
                        // tmp 폴더 정리 시도
                        try { await exec(`rm -rf "${tmpDir}"`); } catch (_) {}
                        vscode.window.showErrorMessage(`Git 클론 실패: ${err.message}`);
                    }
                }
            );
        }],

        // 작업관리 다운로드 (zip)
        ['wizTask.download', async () => {
            if (!workspaceRoot) return;
            const taskPath = path.join(workspaceRoot, '.github', 'task');
            if (!fs.existsSync(taskPath)) {
                vscode.window.showWarningMessage('.github/task 폴더가 없습니다.');
                return;
            }
            await fileManager.download(taskPath, {});
        }],

        // 작업관리 업로드
        ['wizTask.upload', async () => {
            if (!workspaceRoot) return;
            const taskPath = path.join(workspaceRoot, '.github', 'task');
            if (!fs.existsSync(taskPath)) {
                fs.mkdirSync(taskPath, { recursive: true });
            }
            await fileManager.upload(taskPath, context);
        }],

        // 인스트럭션 다운로드 (zip)
        ['wizInstruction.download', async () => {
            if (!workspaceRoot) return;
            const githubPath = path.join(workspaceRoot, '.github');
            if (!fs.existsSync(githubPath)) {
                vscode.window.showWarningMessage('.github 폴더가 없습니다.');
                return;
            }
            await fileManager.download(githubPath, {});
        }],

        // 인스트럭션 업로드
        ['wizInstruction.upload', async () => {
            if (!workspaceRoot) return;
            const githubPath = path.join(workspaceRoot, '.github');
            if (!fs.existsSync(githubPath)) {
                fs.mkdirSync(githubPath, { recursive: true });
            }
            await fileManager.upload(githubPath, context);
        }],

        // 인스트럭션 액션 메뉴 (git/다운로드/업로드 통합)
        ['wizInstruction.actionMenu', async () => {
            const pick = await vscode.window.showQuickPick([
                { label: '$(repo-clone) Git에서 불러오기', id: 'git' },
                { label: '$(cloud-download) 다운로드', id: 'download' },
                { label: '$(cloud-upload) 업로드', id: 'upload' }
            ], { title: '인스트럭션 관리', placeHolder: '작업을 선택하세요' });
            if (!pick) return;
            if (pick.id === 'git') {
                await vscode.commands.executeCommand('wizExplorer.importGithubFromGit');
            } else if (pick.id === 'download') {
                await vscode.commands.executeCommand('wizInstruction.download');
            } else if (pick.id === 'upload') {
                await vscode.commands.executeCommand('wizInstruction.upload');
            }
        }],

        // 인스트럭션 새 파일 생성
        ['wizInstruction.newFile', async () => {
            if (!workspaceRoot) return;
            const githubPath = path.join(workspaceRoot, '.github');
            if (!fs.existsSync(githubPath)) {
                fs.mkdirSync(githubPath, { recursive: true });
            }
            const fileName = await vscode.window.showInputBox({
                title: '새 파일 생성',
                prompt: '파일 이름을 입력하세요',
                placeHolder: 'example.md'
            });
            if (!fileName) return;
            const filePath = path.join(githubPath, fileName);
            if (fs.existsSync(filePath)) {
                vscode.window.showWarningMessage(`'${fileName}' 파일이 이미 존재합니다.`);
                return;
            }
            fs.writeFileSync(filePath, '', 'utf8');
            fileExplorerProvider.refresh();
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(doc);
        }],

        // 인스트럭션 새 폴더 생성
        ['wizInstruction.newFolder', async () => {
            if (!workspaceRoot) return;
            const githubPath = path.join(workspaceRoot, '.github');
            if (!fs.existsSync(githubPath)) {
                fs.mkdirSync(githubPath, { recursive: true });
            }
            const folderName = await vscode.window.showInputBox({
                title: '새 폴더 생성',
                prompt: '폴더 이름을 입력하세요',
                placeHolder: 'new-folder'
            });
            if (!folderName) return;
            const folderPath = path.join(githubPath, folderName);
            if (fs.existsSync(folderPath)) {
                vscode.window.showWarningMessage(`'${folderName}' 폴더가 이미 존재합니다.`);
                return;
            }
            fs.mkdirSync(folderPath, { recursive: true });
            fileExplorerProvider.refresh();
        }],

        // Build command
        ['wizExplorer.build', () => buildManager.normalBuild()],
        ['wizExplorer.selectBuildPythonInterpreter', () => buildManager.selectBuildPythonInterpreter()],

        // npm 패키지 관리
        ['wizExplorer.openNpmManager', () => {
            if (!workspaceRoot) {
                vscode.window.showErrorMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }
            const npmEditor = new NpmEditor(context, {
                wizRoot: workspaceRoot,
                currentProject: currentProject,
                outputChannel: buildManager.getOutputChannel()
            });
            npmEditor.create();
        }],

        // pip 패키지 관리
        ['wizExplorer.openPipManager', async () => {
            let pythonPath = buildManager.getResolvedPythonPath();
            if (!pythonPath || !require('fs').existsSync(pythonPath)) {
                const selected = await buildManager.selectBuildPythonInterpreter();
                if (!selected) return;
                pythonPath = buildManager.getResolvedPythonPath();
            }
            if (!pythonPath) {
                vscode.window.showErrorMessage('Python 환경이 선택되지 않았습니다.');
                return;
            }
            const pipEditor = new PipEditor(context, {
                pythonPath: pythonPath,
                outputChannel: buildManager.getOutputChannel()
            });
            pipEditor.create();
        }],
        
        // File switch commands
        ['wizExplorer.switch.info', () => navigationManager.switchFile('info')],
        ['wizExplorer.switch.controller', () => navigationManager.switchFile('controller')],
        ['wizExplorer.switch.ui', () => navigationManager.switchFile('ui')],
        ['wizExplorer.switch.component', () => navigationManager.switchFile('component')],
        ['wizExplorer.switch.scss', () => navigationManager.switchFile('scss')],
        ['wizExplorer.switch.api', () => navigationManager.switchFile('api')],
        ['wizExplorer.switch.socket', () => navigationManager.switchFile('socket')],
        
        // Active state commands (same behavior)
        ['wizExplorer.switch.info.active', () => navigationManager.switchFile('info')],
        ['wizExplorer.switch.controller.active', () => navigationManager.switchFile('controller')],
        ['wizExplorer.switch.ui.active', () => navigationManager.switchFile('ui')],
        ['wizExplorer.switch.component.active', () => navigationManager.switchFile('component')],
        ['wizExplorer.switch.scss.active', () => navigationManager.switchFile('scss')],
        ['wizExplorer.switch.api.active', () => navigationManager.switchFile('api')],
        ['wizExplorer.switch.socket.active', () => navigationManager.switchFile('socket')],

        // Keyboard navigation commands
        ['wizExplorer.navigatePrevious', () => navigationManager.navigateFile('previous')],
        ['wizExplorer.navigateNext', () => navigationManager.navigateFile('next')],
        ['wizExplorer.openInSplit', () => navigationManager.openCurrentInSplit()],

        // App Menu
        ['wizExplorer.showAppMenu', () => navigationManager.showAppMenu()],

        // Project switching
        ['wizExplorer.switchProject', async () => {
            const result = await projectManager.showProjectMenu(currentProject);
            if (!result) return;

            if (result.action === 'switch' && result.projectName) {
                currentProject = result.projectName;
                updateProjectRoot();
            } else if (result.action === 'delete' && result.projectName && result.projectName !== currentProject) {
                currentProject = result.projectName;
                updateProjectRoot();
            } else if ((result.action === 'import' || result.action === 'importFile') && result.projectName) {
                currentProject = result.projectName;
                updateProjectRoot();
            }
        }],
        ['wizExplorer.copyProjectName', async () => {
            const displayProjectName = resolveProjectNameCase(workspaceRoot, currentProject);
            try {
                await vscode.env.clipboard.writeText(displayProjectName);
                vscode.window.showInformationMessage(`프로젝트명이 복사되었습니다: ${displayProjectName}`);
            } catch (e) {
                vscode.window.showWarningMessage(`클립보드 복사 실패: ${displayProjectName}`);
            }
        }],

        // Create README.md
        ['wizExplorer.createReadme', async () => {
            const projectPath = fileExplorerProvider.workspaceRoot;
            if (!projectPath) {
                vscode.window.showWarningMessage('프로젝트 경로를 찾을 수 없습니다.');
                return;
            }
            const readmePath = path.join(projectPath, 'README.md');
            const projectName = fileExplorerProvider.currentProjectName || 'main';
            const content = `# ${projectName}\n\nProject README\n`;
            fs.writeFileSync(readmePath, content, 'utf8');
            fileExplorerProvider.refresh();
            const MarkdownViewerEditor = require('./editor/editors/markdownViewerEditor');
            await MarkdownViewerEditor.openOrCreate(context, readmePath);
        }],

        // New App
        ['wizExplorer.newApp', async (node) => {
            if (node?.contextValue === 'appGroup') {
                // Standard App (page, component, widget, layout)
                await sourceManager.createApp(node.groupType, node.parentPath);
            } else if (node?.contextValue === 'portalAppGroup') {
                // Portal App
                await packageManager.createPortalApp(node.resourceUri.fsPath);
            } else if (node?.contextValue === 'routeGroup') {
                // Standard Route
                await sourceManager.createRoute(node.resourceUri.fsPath);
            } else if (node?.contextValue === 'portalRouteGroup') {
                // Portal Route
                await packageManager.createPortalRoute(node.resourceUri.fsPath);
            }
        }],

        // Upload App
        ['wizExplorer.uploadApp', async (node) => {
            if (!node) {
                vscode.window.showErrorMessage('앱 그룹을 선택해주세요.');
                return;
            }

            const isPortalApp = node.contextValue === 'portalAppGroup';
            const parentPath = isPortalApp ? node.resourceUri.fsPath : node.parentPath;
            
            if (isPortalApp) {
                await packageManager.showPortalAppUploadWebview(parentPath);
            } else {
                await sourceManager.showUploadWebview(parentPath);
            }
        }],

        // Upload Package
        ['wizExplorer.uploadPackage', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }

            await packageManager.showPackageUploadWebview();
        }],

        // New Package (Portal)
        ['wizExplorer.newPackage', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }
            await packageManager.createPackage();
        }],

        // Export Package
        ['wizExplorer.exportPackage', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('패키지를 선택해주세요.');
                return;
            }
            await packageManager.exportPackage(node.resourceUri.fsPath);
        }],

        // Copy Template
        ['wizExplorer.copyTemplate', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('앱을 선택해주세요.');
                return;
            }
            await navigationManager.copyTemplate(node.resourceUri.fsPath);
        }],

        // File operations
        ['wizExplorer.newFile', async (node) => {
            await fileManager.createFile(node?.resourceUri?.fsPath);
        }],

        ['wizExplorer.newFolder', async (node) => {
            await fileManager.createFolder(node?.resourceUri?.fsPath);
        }],

        ['wizExplorer.delete', async (node, selectedNodes) => {
            const nodes = selectedNodes && selectedNodes.length > 1 ? selectedNodes : (node ? [node] : []);
            if (nodes.length === 0) return;

            const paths = nodes.filter(n => n.resourceUri).map(n => n.resourceUri.fsPath);
            if (paths.length === 0) return;

            await fileManager.deleteMultiple(paths, {
                onDeleted: (deletedPath) => {
                    if (appEditorProvider.currentAppPath === deletedPath) {
                        appEditorProvider.currentWebviewPanel?.dispose();
                    }
                }
            });
        }],

        ['wizExplorer.copy', (node) => {
            if (node) {
                fileManager.copy(node.resourceUri.fsPath);
            }
        }],

        ['wizExplorer.rename', async (node) => {
            if (!node || !node.resourceUri) return;
            await fileManager.rename(node.resourceUri.fsPath, {
                isPortalPackage: node.contextValue === 'portalPackage'
            });
        }],

        ['wizExplorer.downloadFile', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('다운로드할 파일을 선택해주세요.');
                return;
            }
            await fileManager.download(node.resourceUri.fsPath, {
                contextValue: node.contextValue
            });
        }],

        ['wizExplorer.uploadFile', async (node) => {
            if (!node || !node.resourceUri) {
                vscode.window.showErrorMessage('업로드할 폴더를 선택해주세요.');
                return;
            }
            await fileManager.upload(node.resourceUri.fsPath, context);
        }],

        ['wizExplorer.paste', async (node) => {
            await fileManager.paste(node?.resourceUri?.fsPath);
        }],

        ['wizExplorer.openFile', async (resource) => {
            if (resource && !resource.isDirectory) {
                const fsPath = resource.resourceUri.fsPath;
                // todo.md → 커스텀 뷰어로 열기
                if (path.basename(fsPath) === 'todo.md' && fsPath.includes(path.join('.github', 'task'))) {
                    await TodoViewerEditor.openOrCreate(context, fsPath);
                    return;
                }
                // memo.md → 메모 뷰어로 열기
                if (path.basename(fsPath) === 'memo.md' && fsPath.includes(path.join('.github', 'task'))) {
                    await MemoViewerEditor.openOrCreate(context, fsPath);
                    return;
                }
                // .md 파일 → 마크다운 뷰어로 열기
                if (fsPath.endsWith('.md')) {
                    await MarkdownViewerEditor.openOrCreate(context, fsPath);
                    return;
                }
                vscode.commands.executeCommand('vscode.open', resource.resourceUri);
            }
        }],

        ['wizExplorer.revealInExplorer', (resource) => {
            if (resource) {
                vscode.commands.executeCommand('revealFileInOS', resource.resourceUri);
            }
        }],

        ['wizExplorer.openFolder', async () => {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: '폴더 열기'
            });
            
            if (uri?.[0]) {
                await vscode.commands.executeCommand('vscode.openFolder', uri[0]);
            }
        }],

        // Deprecated (kept for compatibility)
        ['wizExplorer.switchAppFile', async () => {}],
        ['wizExplorer.toggleAppFile', async () => {}],

        // ==================== Command Palette Commands ====================
        
        // Direct build commands (without menu selection)
        ['wizExplorer.normalBuild', () => buildManager.normalBuild()],
        ['wizExplorer.cleanBuild', async () => {
            const choice = await vscode.window.showWarningMessage(
                'Clean Build를 실행하시겠습니까? 기존 빌드를 삭제 후 재빌드하므로 시간이 오래 걸릴 수 있습니다.',
                { modal: true },
                '실행'
            );
            if (choice === '실행') {
                buildManager.cleanBuild();
            }
        }],
        ['wizExplorer.showBuildOutput', () => buildManager.showOutput()],

        // Export current project directly
        ['wizExplorer.exportCurrentProject', async () => {
            if (!currentProject) {
                vscode.window.showErrorMessage('프로젝트가 선택되지 않았습니다.');
                return;
            }
            await projectManager.exportProject(currentProject);
        }],

        // Import project file (.wizproject)
        ['wizExplorer.importProject', async () => {
            if (!workspaceRoot) {
                vscode.window.showInformationMessage('워크스페이스가 열려있지 않습니다.');
                return;
            }

            projectManager.ensureProjectFolder();

            const filePath = await projectManager.selectProjectFile();
            if (!filePath) return;

            const projectName = await projectManager.promptProjectName({
                title: '새 프로젝트 이름(Namespace) 입력',
                value: path.basename(filePath, '.wizproject')
            });
            if (!projectName) return;

            const success = await projectManager.importFromFile(filePath, projectName);
            if (success) {
                const choice = await vscode.window.showInformationMessage(
                    `프로젝트 '${projectName}'를 성공적으로 가져왔습니다. 전환하시겠습니까?`,
                    '예', '아니오'
                );
                if (choice === '예') {
                    currentProject = projectName;
                    updateProjectRoot();
                }
            }
        }],

        // Go to App (search by name)
        ['wizExplorer.goToApp', () => navigationManager.goToApp()],

        // Open App Info for current file
        ['wizExplorer.openAppInfo', () => {
            const dirPath = navigationManager.resolveCurrentAppPath();
            if (!dirPath) {
                vscode.window.showWarningMessage('현재 열린 앱 파일이 없습니다.');
                return;
            }
            appEditorProvider.openInfoEditor(dirPath, appContextListener);
        }],

        // Copy template of current app
        ['wizExplorer.copyCurrentTemplate', () => {
            const dirPath = navigationManager.resolveCurrentAppPath();
            navigationManager.copyTemplate(dirPath);
        }],

        // Reveal current file in Wiz Explorer
        ['wizExplorer.revealInWizExplorer', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('열린 파일이 없습니다.');
                return;
            }

            const uri = editor.document.uri;
            let filePath;

            if (uri.scheme === 'file') {
                filePath = uri.fsPath;
            } else if (uri.scheme === 'wiz') {
                filePath = WizPathUtils.getRealPathFromUri(uri);
            }

            if (filePath) {
                try {
                    const item = await fileExplorerProvider.findItem(filePath);
                    if (item) {
                        treeView.reveal(item, { select: true, focus: true, expand: true });
                    }
                } catch (e) {
                    vscode.window.showWarningMessage('Wiz Explorer에서 항목을 찾을 수 없습니다.');
                }
            }
        }],

        // Current Project info (for agent mode / command palette)
        ['wizExplorer.currentProject', () => {
            if (!workspaceRoot) {
                vscode.window.showWarningMessage('워크스페이스가 열려있지 않습니다.');
                return null;
            }
            const projectPath = path.join(workspaceRoot, 'project', currentProject);
            const info = {
                project: currentProject,
                projectPath: projectPath,
                workspaceRoot: workspaceRoot
            };
            vscode.window.showInformationMessage(`현재 Wiz 프로젝트: ${currentProject}`);
            return info;
        }],

        // Create App shortcuts from command palette
        ['wizExplorer.createPage', async () => {
            const location = await navigationManager.selectAppLocation('page');
            if (!location) return;
            
            if (location.type === 'source') {
                await sourceManager.createApp('page', location.path);
            } else {
                await packageManager.createPortalApp(location.path);
            }
        }],

        ['wizExplorer.createComponent', async () => {
            const location = await navigationManager.selectAppLocation('component');
            if (!location) return;
            
            if (location.type === 'source') {
                await sourceManager.createApp('component', location.path);
            } else {
                await packageManager.createPortalApp(location.path);
            }
        }],

        ['wizExplorer.createLayout', async () => {
            const location = await navigationManager.selectAppLocation('layout');
            if (!location) return;
            
            if (location.type === 'source') {
                await sourceManager.createApp('layout', location.path);
            } else {
                await packageManager.createPortalApp(location.path);
            }
        }],

        ['wizExplorer.createRoute', async () => {
            const location = await navigationManager.selectRouteLocation();
            if (!location) return;
            
            if (location.type === 'package') {
                await packageManager.createPortalRoute(location.path);
            } else {
                await sourceManager.createRoute(location.path);
            }
        }]
    ];

    commands.forEach(([id, handler]) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(id, handler)
        );
    });
}

function deactivate() {}

module.exports = { activate, deactivate };
