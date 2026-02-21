# 072. MCP Config Version Sync and Explorer Footer (v1.3.0)

## 개요
VSIX 재설치/업데이트로 익스텐션 설치 경로가 바뀌는 환경에서 MCP 설정 경로 불일치를 자동으로 복구하고, MCP 설정 파일 존재 여부에 따라 메뉴 노출을 정리했습니다. 또한 Wiz Explorer 하단에 현재 익스텐션 버전을 고정 표시하도록 개선했습니다.

## 변경 사항

### 1. MCP 설정 자동 동기화 (버전/경로 불일치 대응)
- `src/services/project/mcpManager.js`
  - MCP 시작 시 `.vscode/mcp.json` 존재 여부를 먼저 검사하도록 변경
  - 설정 파일이 없으면 시작을 막고 Create MCP Configuration 안내 메시지 표시
  - `_syncMcpConfigIfNeeded()` 추가:
    - 기존 `mcp.json`의 `servers.wiz` 설정과 현재 버전 기준 기대 설정(`getConfig()`) 비교
    - 불일치 시 `servers.wiz`만 최신값으로 자동 갱신
  - `_getExtensionVersion()` 추가:
    - 실행 중 익스텐션 정보 또는 `package.json`에서 버전 확인
  - 파일 워처에 `onDidChange` 추가하여 `mcp.json` 수정 시 컨텍스트 즉시 반영

### 2. MCP 메뉴 노출 조건 정리
- `package.json`
  - Explorer 타이틀 메뉴:
    - `startMcpServer`는 `wizExplorer:mcpConfigExists`일 때만 노출
    - `createMcpConfig`는 설정 파일 없을 때만 노출 (기존 유지)
    - `showMcpConfig`는 설정 파일 있을 때만 노출 (기존 유지)
  - Command Palette:
    - `startMcpServer`를 `workspaceFolderCount > 0 && wizExplorer:mcpConfigExists` 조건으로 제한

### 3. 탐색기 하단 버전 푸터 추가
- `src/explorer/fileExplorerProvider.js`
  - 루트 목록 마지막에 `wiz-vscode v{version}` 푸터 아이템을 항상 추가
  - 워크스페이스 없음/폴더 없음 상태에서도 하단에 버전 표시
- `src/explorer/treeItems/emptyItem.js`
  - `versionFooter` 타입 추가 (`info` 아이콘, 툴팁 지원)
- `src/extension.js`
  - `FileExplorerProvider` 생성 시 `context.extension.packageJSON.version` 전달

### 4. 버전 업데이트
- `package.json`
  - 확장 버전을 `1.2.2` → `1.2.3`으로 상향
