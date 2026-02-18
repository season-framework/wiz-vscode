# 060. Python 환경 자동 탐색 및 QuickPick 선택 (v1.2.0)

## 개요
Python 인터프리터 선택 시 시스템에서 사용 가능한 환경을 자동으로 탐색하여 QuickPick 목록으로 제공하는 기능을 추가하였다. 기존 InputBox 방식에서 QuickPick 방식으로 전환하여 사용성을 대폭 개선하였다.

## 변경 사항

### 1. Python 인터프리터 자동 탐색 (`_discoverPythonInterpreters`)
- `src/services/project/buildManager.js`에 `_discoverPythonInterpreters()` 메서드 추가
- 5가지 소스에서 Python 환경을 병렬로 탐색:
  1. **PATH**: `which -a` (Linux/Mac) 또는 `where` (Windows)로 python3, python 탐색
  2. **Conda**: `conda env list --json`으로 conda 환경 탐색
  3. **Pyenv**: `~/.pyenv/versions/` 디렉토리 스캔
  4. **Workspace venv**: 워크스페이스 내 `venv`, `.venv`, `env`, `.env` 디렉토리 탐색
  5. **System paths**: `/usr/bin/python3`, `/usr/local/bin/python3` 등 일반 시스템 경로
- 각 환경의 Python 버전 정보를 `--version` 명령으로 조회
- Wiz 실행 파일 존재 여부를 확인하여 `$(check) wiz` 표시
- wiz가 설치된 환경을 목록 상단에 정렬

### 2. QuickPick 기반 인터프리터 선택 (`_selectInterpreterByPath`)
- 기존 `showInputBox` 방식을 `showQuickPick` 방식으로 전면 교체
- 탐색 중 Progress Notification 표시 ("Python 환경을 검색하고 있습니다...")
- QuickPick 항목 구성:
  - 검색된 Python 환경 목록 (label: 버전, detail: 경로, description: 소스)
  - Separator 구분선
  - "직접 경로 입력..." 옵션 (기존 InputBox fallback)
- `matchOnDetail`, `matchOnDescription` 활성화로 경로와 소스로도 필터링 가능

### 3. 설정 메뉴 구조 변경 (`showBuildMenu`)
- 기존: 빌드 타입 선택 메뉴 (Normal / Clean)
- 변경 후: 상위 메뉴 4개 항목
  - `$(tools) Wiz 빌드` → `_showBuildTypeMenu()` (Normal / Clean 선택)
  - `$(symbol-event) Python 가상환경 선택` → `selectBuildPythonInterpreter()`
  - `$(package) npm 패키지 관리` → `wizExplorer.openNpmManager` 커맨드 실행
  - `$(symbol-method) pip 패키지 관리` → `wizExplorer.openPipManager` 커맨드 실행
- 기존 `showBuildMenu()` 로직은 `_showBuildTypeMenu()`로 분리

### 4. 유틸리티 메서드 추가
- `getResolvedPythonPath()`: 현재 선택된 Python 인터프리터의 resolved 절대 경로 반환
- `getOutputChannel()`: Output Channel 인스턴스를 외부에서 접근할 수 있도록 공개
- `clearEditedDocuments()`: 프로젝트 전환 시 편집 추적 Set 초기화

### 5. 빌드 디바운스 및 안정성 개선
- `triggerBuild()`에 500ms 디바운스 적용 (연속 저장 시 마지막 요청만 빌드 실행)
- 실제 빌드 로직을 `_execTriggerBuild()`로 분리
- 이전 빌드 프로세스 종료 시 `process.kill(pid)` 사용으로 안정성 개선

## 관련 파일
- `src/services/project/buildManager.js`
- `src/extension.js` (프로젝트 전환 시 `clearEditedDocuments()` 호출 추가)
