# 017 - Portal Info 에디터 구현

## 개요
portal.json 전용 Webview 에디터 추가

## 요구사항
`portal.json` 파일을 클릭할 때 일반 텍스트 에디터 대신 전용 UI 에디터로 표시

## 구현 내용

### 1. 에디터 등록 (`src/editor/appEditorProvider.js`)
- `openPortalInfoEditor()` 메소드 추가
- Package, Title, Version 필드만 UI에 표시
- `use_*` 필드들은 UI에서 숨기고 저장 시 자동으로 `true`로 설정

### 2. 트리뷰 연동 (`src/explorer/fileExplorerProvider.js`)
- `portal.json` 파일 감지 시 라벨을 `info`로 변경
- 클릭 시 `wizExplorer.openPortalInfo` 커맨드 실행

### 3. 커맨드 등록 (`src/extension.js`)
- `wizExplorer.openPortalInfo` 커맨드 등록

## 저장 시 자동 적용되는 필드

```javascript
{
    package: "...",
    title: "...",
    version: "...",
    use_app: true,
    use_widget: true,
    use_route: true,
    use_libs: true,
    use_styles: true,
    use_assets: true,
    use_controller: true,
    use_model: true
}
```
