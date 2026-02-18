# 064. Current Project 커맨드 추가 (v1.2.1)

## 개요
에이전트 모드(Copilot 등)에서 현재 선택된 Wiz 프로젝트를 조회할 수 있도록 `Wiz: Current Project` 커맨드를 추가하였다.

## 변경 사항

### 1. 커맨드 등록 (package.json)
- `wizExplorer.currentProject` 커맨드를 `"Wiz: Current Project"` 타이틀로 등록
- `commandPalette`에 `workspaceFolderCount > 0` 조건으로 노출

### 2. 커맨드 핸들러 구현 (src/extension.js)
- 현재 프로젝트 정보를 반환하는 `wizExplorer.currentProject` 핸들러 추가
- 반환값: `{ project, projectPath, workspaceRoot }` 객체
  - `project`: 현재 선택된 프로젝트 이름 (예: `main`)
  - `projectPath`: 프로젝트 절대 경로 (`{workspaceRoot}/project/{project}`)
  - `workspaceRoot`: Wiz 워크스페이스 루트 경로
- 사용자에게 `현재 Wiz 프로젝트: {name}` 정보 메시지 표시
- 워크스페이스가 열려있지 않으면 경고 메시지 후 `null` 반환

### 3. 활용
- 커맨드 팔레트에서 `Wiz: Current Project` 실행 시 현재 프로젝트 확인 가능
- 에이전트 모드에서 `vscode.commands.executeCommand('wizExplorer.currentProject')` 호출로 프로젝트 상태 조회
