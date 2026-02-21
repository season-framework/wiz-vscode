# 076. MCP 네이티브 위임 & 자동 업데이트 (v1.3.0)

## 개요
MCP 서버 관리를 VS Code 네이티브 체계에 완전 위임하고, GitHub에서 최신 버전을 자동 확인하여 vsix로 업데이트하는 기능을 추가했습니다.

## 변경 사항

### 1. MCP 서버 관리 → VS Code 네이티브 위임
- `src/services/project/mcpManager.js`
  - `cp.spawn` 기반 독립 프로세스 관리 완전 제거 (`child_process` import 제거)
  - `serverProcess`, `outputChannel` 프로퍼티 제거
  - `start()`: mcp.json에 wiz 서버 설정 추가 (VS Code가 자동으로 수명주기 관리)
  - `stop()`: mcp.json에서 wiz 서버 설정 제거 (다른 서버 설정 보존)
  - `_hasWizServer()`: mcp.json 내 wiz 서버 존재 여부로 상태 판단
  - `_ensureConfig()`: mcp.json에 wiz 서버 설정 보장 (없으면 생성/추가)
  - `_notifyState()`: 상태 알림 통합 (context key + onStateChange 콜백)
  - `_watchMcpConfig()`: `onDidChange` 이벤트도 감시하여 파일 내용 변경 시에도 트리 갱신
  - `dispose()`: 프로세스 kill 로직 제거, 세션 정리 + 워처 해제만 수행

### 2. Settings 트리 MCP 서버 메뉴 제거
- `src/explorer/models/categoryHandlers.js`
  - MCP Server Enable/Disable 메뉴 항목 제거 (VS Code 네이티브 관리에 위임)

### 3. 최신 버전 자동 확인 & 업데이트
- `src/explorer/fileExplorerProvider.js`
  - `latestVersion` 프로퍼티 추가
- `src/extension.js`
  - 익스텐션 로딩 시 GitHub API(`/repos/season-framework/wiz-vscode/tags?per_page=1`)에서 최신 태그 조회
  - `wizExplorer.updateExtension` 커맨드: GitHub releases vsix URL로 직접 설치
    - URL 패턴: `https://github.com/season-framework/wiz-vscode/releases/download/v{version}/wiz-vscode-{version}.vsix`
    - 진행 상태 Notification 표시, 설치 완료 후 다시 로드 안내
- `src/explorer/models/categoryHandlers.js`
  - Settings 버전 항목: 최신 버전 비교하여 업데이트 가능 시 `version: v1.3.0 → v1.3.0 ⬆ update` 표시
  - `cloud-download` 아이콘 + 클릭 시 업데이트 커맨드 실행
  - `_compareVersions()` 시맨틱 버전 비교 메서드 추가
- `package.json`
  - `wizExplorer.updateExtension` 커맨드 등록
