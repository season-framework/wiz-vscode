# 071. MCP pip/npm 패키지 관리 도구 추가 (v1.2.2)

## 개요
MCP 서버에 pip 및 npm 패키지 설치, 제거, 목록 조회 기능을 추가하여 AI 에이전트가 프로젝트 의존성을 관리할 수 있도록 함.

## 변경 사항

### 1. MCP 도구 정의 추가 (`src/mcp/index.js`)
Dependency Management 카테고리로 6개 도구 추가:

| 도구 | 설명 |
|------|------|
| `wiz_pip_list` | pip 패키지 목록 조회 (outdated 옵션 지원) |
| `wiz_pip_install` | pip 패키지 설치 (upgrade 옵션 지원) |
| `wiz_pip_uninstall` | pip 패키지 제거 |
| `wiz_npm_list` | npm 패키지 목록 조회 (outdated, global 옵션 지원) |
| `wiz_npm_install` | npm 패키지 설치 (dev, global 옵션 지원) |
| `wiz_npm_uninstall` | npm 패키지 제거 (global 옵션 지원) |

### 2. pip 헬퍼 메서드 (`src/mcp/index.js`)
- `_getPipPath(workspacePath)`: 워크스페이스 가상환경(venv/.venv/env) 자동 탐지, 없으면 시스템 pip3 사용
- `pipList`: `pip list --format=json` 실행, outdated 옵션 시 `--outdated` 플래그 추가
- `pipInstall`: `pip install` 실행, upgrade 옵션 시 `--upgrade` 플래그 추가
- `pipUninstall`: `pip uninstall -y` 실행 (자동 확인)

### 3. npm 헬퍼 메서드 (`src/mcp/index.js`)
- `_getNpmCwd(workspacePath, projectName, global)`: npm 실행 디렉토리 결정 (프로젝트 package.json 존재 시 프로젝트 디렉토리, 아니면 workspace root)
- `npmList`: `npm list --json --depth=0` 실행, outdated 옵션 시 `npm outdated --json` 실행
- `npmInstall`: `npm install` 실행, dev 옵션 시 `--save-dev` 플래그, package.json 없으면 `npm init -y` 자동 실행
- `npmUninstall`: `npm uninstall` 실행

### 4. 핸들러 등록 (`src/mcp/index.js`)
- `_getToolHandler()` 맵에 6개 도구 핸들러 등록
- Tool Categories 주석 업데이트: Dependency Management (6) 카테고리 추가
