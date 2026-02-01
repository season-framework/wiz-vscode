# 011 - 창 분할 시 Wiz 탭 복원 버그 수정

## 개요
URI 인코딩 및 Webview 상태 복원 구현

## 문제
에디터 창 분할 시 wiz:// 관련 info/ui/component 탭이 새 창에서 컨텍스트를 잃어버리는 문제

## 원인

1. URI 쿼리 파라미터의 Base64 인코딩 문자열이 URL 인코딩되지 않음
2. Info 탭(Webview)에 상태 복원 로직 없음

## 해결

1. `src/core/uriFactory.js` - `encodeURIComponent()` 적용
2. `src/editor/appEditorProvider.js` - `reviveInfoEditor()` 메소드 추가, `vscode.setState()` 호출
3. `src/extension.js` - `vscode.window.registerWebviewPanelSerializer('wizAppInfo', ...)` 등록
