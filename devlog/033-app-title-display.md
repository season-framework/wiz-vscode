# 033 - App 트리 아이템 표기 개선

## 개요
App 목록에서 ID 대신 Title을 메인으로 표시 (ID는 설명으로 이동)

## 요구사항
App 목록(page, component 등)에서 파일명(ID) 대신 알아보기 쉬운 Title을 우선 표시

## 구현

`src/explorer/treeItems/appGroupItem.js`:

- 각 App 폴더 내의 `app.json` 파일을 읽어 `title` 필드 확인
- **Title 존재 시**: Label을 `title`로 설정, 원래 ID는 Description으로 이동 (예: `메인 페이지` `home`)
- **Title 부재 시**: 기존대로 ID를 Label로 사용
