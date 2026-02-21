# 073. Settings Category & UX Improvements (v1.3.0)

## 개요
탐색기 하단 버전 푸터를 전면 개편하여 "wiz settings" 카테고리로 재구성하고, MCP 설정 메뉴/상태 동기화, 프로젝트명 복사, 빌드 UX 등 다수의 기능 개선을 진행했습니다.

## 변경 사항

### 1. Settings 카테고리 전면 구축
- `src/explorer/models/categoryHandlers.js`
  - `SettingsCategory` 클래스 추가 (기본 Expanded 상태)
  - 하위 항목: project, version, mcp configuration, mcp server start/stop, clean build, python env, python packages, npm packages
  - MCP 상태(`mcpConfigExists`, `mcpServerRunning`)에 따라 라벨/아이콘/명령 동적 전환
- `src/explorer/fileExplorerProvider.js`
  - `mcpConfigExists`, `mcpServerRunning`, `currentProjectName` 프로퍼티 추가
  - 카테고리 배열 첫 번째에 `SettingsCategory` 배치
- `src/explorer/treeItems/emptyItem.js`
  - 기존 `versionFooter` 타입 제거 (SettingsCategory로 대체)

### 2. MCP 설정 메뉴 및 초기화
- `src/extension.js`
  - `wizExplorer.mcpConfigMenu` 커맨드 추가: QuickPick으로 "설정 보기" / "초기화 하기" 선택
  - 설정 파일 없으면 바로 `createConfig()` 호출
- `src/services/project/mcpManager.js`
  - `resetConfig()` 메서드 추가: 서버 중지 → mcp.json 재생성 → 에디터에서 열기
  - `onStateChange` 콜백 기반 상태 전파 구조 도입
  - `_notifyStateChange()`: `_lastState` 비교로 중복 refresh 방지
  - 3초 간격 상태 폴링 타이머: VS Code 네이티브 MCP UI에서 직접 시작/중지해도 탐색기에 반영

### 3. 프로젝트명 표시 및 복사
- `src/extension.js`
  - `resolveProjectNameCase()` 함수 추가: 실제 디렉토리 대소문자와 일치하도록 프로젝트명 해석
  - `wizExplorer.copyProjectName` 커맨드: 프로젝트명 클립보드 복사 + 알림 표시
  - try-catch로 클립보드 접근 실패 시에도 알림 표시되도록 보완
- `src/explorer/models/categoryHandlers.js`
  - Settings 카테고리 첫 번째 항목으로 `project: {name}` 표시, 클릭 시 복사 커맨드 실행

### 4. 빌드 UX 개선
- `src/extension.js`
  - `wizExplorer.build`: 메뉴 표시 대신 `normalBuild()` 직접 실행으로 변경
  - `wizExplorer.cleanBuild` 커맨드 추가: 모달 경고 다이얼로그 확인 후 실행
- `src/explorer/models/categoryHandlers.js`
  - Settings 카테고리에 `clean build` 항목 추가

### 5. 툴바 정리
- `package.json`
  - Explorer 타이틀 메뉴에서 MCP/Python/Pip/Npm 버튼 제거
  - refresh, build, switchProject 3개만 유지
  - `copyProjectName`, `mcpConfigMenu`, `cleanBuild` 커맨드 정의 추가
