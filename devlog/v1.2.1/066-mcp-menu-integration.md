# 066. MCP 서버 메뉴 통합 (v1.2.1)

## 개요
MCP 서버 시작/중지/설정 기능을 Wiz Explorer 상단 메뉴(view/title)에서 직접 접근할 수 있도록 추가하고, 서버 실행 상태에 따라 메뉴 항목이 동적으로 전환되도록 구현했다.

## 변경 사항

### 1. package.json - view/title 메뉴 항목 추가
- **Start MCP Server**: 서버 미실행 시 표시 (`!wizExplorer:mcpServerRunning`)
- **Stop MCP Server**: 서버 실행 중 표시 (`wizExplorer:mcpServerRunning`)
- **Show MCP Configuration**: 항상 표시
- 그룹: `1_mcp` (... 드롭다운 메뉴 내 별도 섹션)

### 2. package.json - 커맨드 아이콘 추가
- `wizExplorer.startMcpServer`: `$(debug-start)` 아이콘
- `wizExplorer.stopMcpServer`: `$(debug-stop)` 아이콘
- `wizExplorer.showMcpConfig`: `$(settings-gear)` 아이콘

### 3. McpManager - Context Key 동기화
- `src/services/project/mcpManager.js`에 `_updateContext()` 메서드 추가
- `wizExplorer:mcpServerRunning` context key를 서버 상태에 따라 자동 동기화
- 적용 시점: 생성자 초기화, 서버 시작 후, 서버 중지 후, 프로세스 종료(close), 에러(error) 발생 시
