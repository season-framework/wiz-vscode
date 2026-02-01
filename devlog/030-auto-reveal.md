# 030 - 탐색기 자동 하이라이팅 구현

## 개요
활성화된 에디터 파일에 맞춰 탐색기 항목 자동 선택

## 요구사항
현재 활성화된 에디터 탭의 파일에 해당하는 탐색기 항목 자동 선택/하이라이팅

## 구현 내용

### 1. 이벤트 리스너 등록 (`src/extension.js`)
- `vscode.window.onDidChangeActiveTextEditor` 이벤트 감지
- `wiz://` (가상 파일) 및 `file://` (일반 파일) 스킴 모두 지원
- 파일 경로 추출 후 `treeView.reveal` 호출

### 2. 아이템 검색 로직 구현 (`src/explorer/fileExplorerProvider.js`)
- `findItem(filePath)` 메서드 추가
- **App 단위 추적**: 파일이 App(`src/page/home/view.pug` 등) 내부에 있는 경우, 개별 파일 대신 **App 폴더**(`src/page/home`)를 반환하여 하이라이팅
- `flatten`된 구조(Route 등) 및 Portal App 구조 재귀적 탐색 지원

### 3. 트리 아이템 식별자 (`src/explorer/treeItems/fileTreeItem.js`)
- `treeView.reveal`의 정확한 동작을 위해 `FileTreeItem`에 `id` 속성(fsPath) 추가

### 4. 부모 노드 탐색 (`getParent`)
- 트리 확장을 위해 `getParent` 메서드에서 카테고리(`source`, `portal`) 및 평탄화된 폴더 구조 처리 로직 강화
