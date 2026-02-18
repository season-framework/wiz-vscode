# 068. MCP-Explorer 프로젝트 동기화 (v1.2.1)

## 개요
MCP 서버가 VS Code Explorer에서 선택된 프로젝트와 실시간으로 동기화되도록 상태 파일 기반 연동 메커니즘을 구현했다. 이전에는 환경변수(`WIZ_PROJECT`)로 고정된 프로젝트만 접근 가능했으나, 이제 Explorer에서 프로젝트를 전환하면 MCP 서버가 자동으로 반영한다.

## 변경 사항

### 1. 상태 파일 기반 동기화 (.vscode/.wiz-state.json)
- Extension이 프로젝트 전환 시 `.vscode/.wiz-state.json`에 `workspacePath`와 `currentProject` 기록
- MCP 서버가 매 tool 호출 시 상태 파일에서 최신 프로젝트를 읽어 자동 반영

### 2. MCP 서버 (src/mcp/index.js) 변경
- `_loadState()`: 상태 파일에서 `currentProject`/`workspacePath` 로드
- `_saveState()`: MCP에서 프로젝트 전환 시 상태 파일에 기록 (역방향 동기화)
- `_resolveArgs()`: 모든 tool 호출에서 `workspacePath`/`projectName` 자동 주입
- `wiz_get_workspace_state` 도구 추가: 에이전트가 현재 활성 워크스페이스/프로젝트 확인 가능
- 모든 tool 정의에서 `workspacePath`/`projectName`을 `required`에서 제거 → optional
- 설명에 "(auto-detected from VS Code Explorer if omitted)" 자동 추가
- `switchProject`에서 `_saveState()` 호출하여 Extension 측과 양방향 동기화
- 생성자에서 `process.env.WIZ_WORKSPACE`로 초기화 후 `_loadState()`로 최신 상태 덮어쓰기

### 3. McpManager (src/services/project/mcpManager.js) 변경
- `writeState()` 메서드 추가: `.vscode/.wiz-state.json`에 현재 상태 기록
- 생성자에서 `writeState()` 호출 (초기화 시 동기화)
- `getConfig()`에서 `WIZ_PROJECT` 환경변수 제거 (상태 파일로 대체)

### 4. extension.js 변경
- `updateProjectRoot()`에서 `mcpManager.writeState()` 호출
- 프로젝트 전환 즉시 MCP 서버에 반영

### 동작 흐름
```
Explorer 프로젝트 전환
  → updateProjectRoot()
  → mcpManager.writeState() → .vscode/.wiz-state.json 기록
  → MCP 서버 다음 호출 시 _resolveArgs() → _loadState() → 최신 프로젝트 반영
```
