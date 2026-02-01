# 015 - Route 앱 UI 개선

## 개요
아이콘 제거, 탭 순서 변경, 기본 파일을 Controller로 설정

## 변경 사항

### 1. 아이콘 제거
Route 하위 앱들에서 폴더 아이콘 설정 제거
- `src/explorer/fileExplorerProvider.js` - `item.setFolderIcon()` 호출 제거

### 2. 탭 순서 변경
Info -> Controller 순서로 표시
- `package.json` - Controller를 `navigation@2`로 변경

### 3. 기본 파일 변경
Route 앱 클릭 시 Controller 파일 열기
- `src/editor/appEditorProvider.js` - `openEditor()` 메소드에서 groupType이 'route'인 경우 controller 파일 우선
