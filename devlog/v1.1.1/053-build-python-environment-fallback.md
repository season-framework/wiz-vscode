# 053. 자동 빌드 Python 환경 선택 및 Wiz 실행 경로 개선 (v1.1.1)

## 개요
저장 후 자동 빌드에서 `wiz` 명령을 찾지 못하는 환경(venv/conda 등)을 안정적으로 처리하기 위해, Python 인터프리터 선택/저장 기반 빌드 폴백을 추가하고 실행 경로/로그를 정리했다.

## 변경 사항

### 1. BuildManager 빌드 실행 로직 개선
- `src/services/project/buildManager.js`에서 기존 `wiz` 고정 실행 흐름을 확장해, 저장된 Python 인터프리터 환경의 `wiz` 실행 파일을 우선 사용하도록 개선했다.
- `wiz` 미탐지 시 Python 환경 선택 후 재시도하도록 폴백 경로를 추가했다.
- 빌드 실행 경로(`cwd`)를 Wiz 루트 기준으로 유지해 실행 컨텍스트 일관성을 확보했다.

### 2. Python 인터프리터 선택/저장 기능 추가
- `src/services/project/buildManager.js`에 빌드용 Python 경로 저장/재사용 로직을 추가했다.
- Python 인터프리터 선택 확장(`Python: Select Interpreter`)이 있으면 이를 우선 사용하고, 없거나 결과를 확인할 수 없으면 수동 입력으로 전환하도록 단순화했다.
- 선택된 인터프리터는 워크스페이스 설정에 저장되어 자동 빌드 시 재사용된다.

### 3. 명령 및 설정 기여 항목 추가
- `src/extension.js`에 `wizExplorer.selectBuildPythonInterpreter` 명령 등록을 추가했다.
- `package.json`에 명령/커맨드 팔레트 항목을 추가했다.
- `package.json`에 다음 설정을 추가했다.
  - `wizExplorer.build.pythonInterpreterPath`
  - `wizExplorer.build.promptPythonSelectionOnMissingWiz`
