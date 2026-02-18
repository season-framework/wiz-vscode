# 062. pip 패키지 관리 에디터 (v1.2.0)

## 개요
선택된 Python 가상환경의 pip 패키지를 시각적으로 관리할 수 있는 Webview 에디터를 추가하였다. npm 에디터와 동일한 카드 기반 UI 패턴을 사용하며, 설치·삭제·업그레이드·검색 기능을 제공한다.

## 변경 사항

### 1. PipEditor 클래스 신규 생성
- `src/editor/editors/pipEditor.js` (613줄) 신규 작성
- `EditorBase`를 상속하여 Webview 패널 생성 및 생명주기 관리
- 현재 설정된 Python 인터프리터 경로를 사용하여 `python -m pip` 명령 실행
- Python 환경 미선택 시 자동으로 `selectBuildPythonInterpreter()` 호출

### 2. Webview UI 구성
- npm 에디터와 동일한 카드 기반 레이아웃 (max-width 860px)
- @vscode/codicons 아이콘 사용
- 검색/필터 바: 실시간 입력으로 설치된 패키지 목록 필터링
- 툴바 버튼: 아이콘 + 텍스트 라벨
  - `$(cloud-download) Install` — 패키지 설치
  - `$(arrow-up) Upgrade All` — 전체 업그레이드
  - `$(sync) Outdated` — 업데이트 가능 패키지 확인
  - `$(refresh) Refresh` — 목록 새로고침

### 3. 패키지 관리 기능
- **설치**: 패키지명 입력 → `pip install` 실행
- **삭제**: `pip uninstall -y` 실행
- **업그레이드**: 개별 `pip install --upgrade` 또는 전체 업그레이드
- **Outdated 확인**: `pip list --outdated --format=json`으로 업데이트 가능 패키지 표시
- **패키지 목록**: `pip list --format=json`으로 JSON 형식 목록 조회

### 4. 커맨드 등록
- `wizExplorer.openPipManager` 커맨드를 `package.json`과 `extension.js`에 등록
- Command Palette에서 "Wiz: pip Package Manager"로 접근 가능
- `showBuildMenu()` 상위 메뉴에서도 접근 가능
- Python 환경 미설정 시 자동으로 환경 선택 다이얼로그 표시

## 관련 파일
- `src/editor/editors/pipEditor.js` (신규)
- `src/extension.js` (커맨드 등록, Python 환경 자동 선택 로직)
- `package.json` (커맨드 선언)
- `src/services/project/buildManager.js` (`getResolvedPythonPath()` 활용)
