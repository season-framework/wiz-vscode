# 069. MCP 경로 자동 해석 (v1.2.1)

## 개요
MCP 서버에서 에이전트가 상대 경로를 넘겼을 때 프로젝트 루트 기준으로 올바르게 절대 경로로 변환되도록 경로 해석 로직을 추가했다. 이전에는 `src/portal/dizest/app/drive` 같은 상대 경로가 Wiz 루트에서 찾아져 `app.json not found` 오류가 발생했다.

## 변경 사항

### 1. _resolvePath() 메서드 추가
- `src/mcp/index.js`
- 절대 경로(`/`로 시작) → 그대로 반환
- `src/`로 시작하는 상대 경로 → `{projectRoot}/src/...`
- 프로젝트 루트에 직접 존재하는 경로 → `{projectRoot}/...` (package.json 등)
- 나머지 상대 경로 → `{projectRoot}/src/...` (기본값, portal/app/route 등)

### 2. _resolveArgs() 확장
- 기존: `workspacePath`/`projectName` 자동 주입만 수행
- 변경: 7개 경로 파라미터(`appPath`, `dirPath`, `filePath`, `targetPath`, `folderPath`, `oldPath`, `newPath`)도 자동 변환

### 3. Tool 정의 설명 보강
- 경로 파라미터에 `"(relative paths like 'src/portal/pkg/app/name' are auto-resolved to the project root)"` 안내 자동 추가

### 경로 해석 예시
| 입력 | 해석 결과 |
|------|-----------|
| `/abs/path/to/app` | `/abs/path/to/app` (그대로) |
| `src/portal/dizest/app/drive` | `{projectRoot}/src/portal/dizest/app/drive` |
| `portal/dizest/app/drive` | `{projectRoot}/src/portal/dizest/app/drive` |
| `package.json` | `{projectRoot}/package.json` (존재 시 우선) |
