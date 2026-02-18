# 057. Copilot/Config 카테고리 경로 및 파일 조작 수정 (v1.1.2)

## 개요
Copilot 카테고리와 Config 카테고리의 `resourceUri`가 초기화 시점에 고정되어, 이후 워크스페이스 경로가 설정되어도 갱신되지 않던 문제를 수정했다. 또한 해당 카테고리에서 파일/폴더 생성 및 드래그 앤 드롭이 동작하지 않던 문제를 함께 수정했다.

## 변경 사항

### 1. 카테고리 resourceUri 동적 반환
**파일:** `src/explorer/models/categoryHandlers.js`

- `CopilotCategory`와 `ConfigCategory`의 `resourceUri`를 constructor 시점 정적 할당에서 getter 기반 동적 반환으로 변경
- `provider.wizRoot` / `provider.workspaceRoot`의 현재 값을 기반으로 접근 시마다 올바른 경로를 반환
- `set resourceUri()` no-op setter 추가하여 TreeItem 내부 할당 충돌 방지
- `ConfigCategory.getChildren()`에 `workspaceRoot` null guard 추가

### 2. 파일/폴더 생성 시 부모 디렉토리 자동 생성
**파일:** `src/services/file/fileManager.js`

- `createFile()`: 파일 생성 전 `fs.mkdirSync(dir, { recursive: true })` 추가
- `createFolder()`: 폴더 생성 전 부모 디렉토리 보장 로직 추가
- `.github` 폴더가 아직 없는 상태에서 Copilot 카테고리에 파일/폴더 추가 시 정상 동작

### 3. 드래그 앤 드롭 카테고리 지원
**파일:** `src/explorer/wizDragAndDropController.js`

- `isDropTarget()`: `copilotCategory`와 `configCategory`를 드롭 대상으로 허용 (`resourceUri`가 있는 경우)
- `handleDrop()`: 드롭 대상 폴더가 존재하지 않으면 자동 생성하는 로직 추가

## 기대 효과

1. Copilot 카테고리에서 파일/폴더 생성 시 `.github` 폴더가 자동 생성되며 올바른 경로에 파일이 위치
2. Config 카테고리도 동일하게 동적 경로 반환으로 안정성 확보
3. 파일을 Copilot/Config 카테고리로 드래그 앤 드롭하여 이동 가능
