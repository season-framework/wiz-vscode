# 067. MCP 설정 파일 자동 저장 (v1.2.1)

## 개요
MCP 설정이 untitled 문서로만 열리던 방식을 `.vscode/mcp.json` 파일로 직접 저장되도록 변경하고, 파일 존재 여부에 따라 Create/Show 메뉴가 동적으로 전환되도록 구현했다.

## 변경 사항

### 1. McpManager - 설정 파일 직접 저장
- `src/services/project/mcpManager.js`
- `showConfig()`: untitled 문서 대신 `.vscode/mcp.json` 파일을 직접 열기
- `createConfig()`: `.vscode/mcp.json` 파일 생성 + `.vscode/` 디렉토리 자동 생성 후 열기
- `_getMcpJsonPath()`: 워크스페이스의 `.vscode/mcp.json` 경로 반환 유틸리티
- `updateMcpConfigContext()`: `wizExplorer:mcpConfigExists` context key로 파일 존재 여부 추적
- `_watchMcpConfig()`: `FileSystemWatcher`로 파일 생성/삭제 감지 시 자동 context 갱신
- `getConfig()`: VS Code MCP 표준에 맞게 `mcpServers` → `servers`로 키 변경
- `fs` require 추가

### 2. package.json - 커맨드 및 메뉴 동적 전환
- `wizExplorer.createMcpConfig` 커맨드 추가 (아이콘: `$(add)`)
- view/title 메뉴: `wizExplorer:mcpConfigExists` 조건으로 Show/Create 동적 전환
- commandPalette: 같은 조건으로 Show/Create 동적 노출

### 3. extension.js - 커맨드 등록
- `wizExplorer.createMcpConfig` → `mcpManager.createConfig()` 핸들러 등록

### 4. dispose 정리
- `_mcpConfigWatcher` 리소스 정리 추가
