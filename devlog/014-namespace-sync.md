# 014 - Namespace 변경 시 폴더명/ID 자동 변경

## 개요
Info 에디터에서 namespace 수정 시 연동

## 요구사항
Info 에디터에서 namespace 변경 시 폴더명과 app.json의 id도 함께 변경

## 구현

`src/editor/appEditorProvider.js` - `handleUpdate()`:

Route가 아닌 앱에서 namespace가 변경된 경우:
1. 폴더명을 `{category}.{newNamespace}`로 변경
2. app.json의 id를 동일하게 업데이트
3. 파일 탐색기 새로고침
4. 기존 웹뷰 닫기
