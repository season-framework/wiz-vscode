# 075. MCP 상태 동기화 개선 & Git에서 .github 불러오기 (v1.3.0)

## 개요
MCP 서버 실행 상태가 트리뷰에 정확히 반영되도록 `onStateChange` 콜백 연동을 수정하고, mcp.json이 없을 때 서버 시작 시 자동 생성하도록 개선했습니다. 또한 Copilot 카테고리(.github)에 Git 레포에서 불러오기 기능을 추가했습니다.

## 변경 사항

### 1. MCP 서버 상태 동기화
- `src/services/project/mcpManager.js`
  - 생성자에서 `onStateChange` 콜백 저장
  - `_updateContext()`: `setContext` 실행 후 `onStateChange` 콜백도 함께 호출하여 트리뷰 갱신
  - `updateMcpConfigContext()`: mcp.json 존재 여부 변경 시에도 `onStateChange` 호출

### 2. mcp.json 자동 생성
- `src/services/project/mcpManager.js`
  - `start()` 메서드를 `async`로 변경
  - 서버 시작 전 mcp.json 미존재 시 `createConfig()` 자동 호출
- `package.json`
  - `commandPalette`의 `startMcpServer` when 조건에서 `wizExplorer:mcpConfigExists` 제거 (mcp.json 없어도 시작 가능)

### 3. Git에서 .github 불러오기
- `package.json`
  - `wizExplorer.importGithubFromGit` 커맨드 등록 (icon: `$(cloud-download)`)
  - Copilot 카테고리(`copilotCategory`) 우클릭 컨텍스트 메뉴에 `0_import` 그룹으로 추가
- `src/extension.js`
  - `wizExplorer.importGithubFromGit` 핸들러 구현
  - Git URL 입력 다이얼로그 → 경고 메시지(기존 .github 삭제 안내) → 확인 후 클론
  - 클론 완료 후 `.git` 디렉토리 제거 (독립 레포 히스토리 불필요)
  - 진행 상태 Notification progress 표시
  - 성공/실패 메시지 출력 및 탐색기 자동 새로고침
