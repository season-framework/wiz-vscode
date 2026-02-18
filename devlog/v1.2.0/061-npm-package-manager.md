# 061. npm 패키지 관리 에디터 (v1.2.0)

## 개요
프로젝트의 npm 패키지를 시각적으로 관리할 수 있는 Webview 에디터를 추가하였다. 카드 기반 UI로 패키지 목록을 표시하며, 설치·삭제·업그레이드·검색 기능을 제공한다.

## 변경 사항

### 1. NpmEditor 클래스 신규 생성
- `src/editor/editors/npmEditor.js` (735줄) 신규 작성
- `EditorBase`를 상속하여 Webview 패널 생성 및 생명주기 관리
- 빌드 디렉토리: `project/{currentProject}/build` 내 `package.json` 관리
- 설치 후 `src/angular/package.json`으로 자동 동기화

### 2. Webview UI 구성
- **@vscode/codicons** 패키지를 devDependency로 설치하여 Webview에서 VS Code 아이콘 사용
- 카드 기반 레이아웃 (max-width 860px, 가운데 정렬)
- 검색/필터 바: 실시간 입력으로 설치된 패키지 목록 필터링
- 툴바 버튼: 아이콘 + 텍스트 라벨 구성
  - `$(cloud-download) Install` — 패키지 설치
  - `$(arrow-up) Upgrade All` — 전체 업그레이드
  - `$(sync) Outdated` — 업데이트 가능 패키지 확인
  - `$(refresh) Refresh` — 목록 새로고침

### 3. 패키지 관리 기능
- **설치**: 패키지명 입력 → devDependency 옵션 선택 → `npm install` 실행
- **삭제**: 패키지 카드의 삭제 버튼 클릭 → `npm uninstall` 실행
- **업그레이드**: 개별 패키지 업그레이드 또는 전체 업그레이드 (`npm update`)
- **Outdated 확인**: `npm outdated --json`으로 업데이트 가능 패키지 표시
- **검색 필터**: 클라이언트 사이드 실시간 필터링

### 4. 커맨드 등록
- `wizExplorer.openNpmManager` 커맨드를 `package.json`과 `extension.js`에 등록
- Command Palette에서 "Wiz: npm Package Manager"로 접근 가능
- `showBuildMenu()` 상위 메뉴에서도 접근 가능

## 관련 파일
- `src/editor/editors/npmEditor.js` (신규)
- `src/extension.js` (커맨드 등록)
- `package.json` (커맨드 선언, devDependency 추가)
