# 020 - Portal App 생성 기능

## 개요
app 폴더 컨텍스트 메뉴에서 새 Portal App 생성

## 요구사항
Portal 패키지의 `app` 폴더에서 우클릭 → "새 앱 만들기" 기능

## 구현 내용

### 1. CreatePortalAppEditor 클래스 (`src/editor/editors/createPortalAppEditor.js`)
- Namespace (필수), Title, Category, View URI, Controller 입력 폼
- 생성 시 폴더 구조 및 기본 파일 자동 생성

### 2. 트리뷰 컨텍스트 (`src/explorer/fileExplorerProvider.js`)
- `app` 폴더에 `portalAppGroup` contextValue 설정
- `layers` 아이콘 적용 (Source의 page/component 그룹과 동일)

### 3. 메뉴 등록 (`package.json`)
- `portalAppGroup` 컨텍스트에서 "New Portal App" 메뉴 표시

### 4. 생성되는 파일 구조

```
src/portal/<package>/app/<namespace>/
├── app.json      # id, mode, title, namespace, category, viewuri, controller, template
├── view.pug
├── view.scss
└── view.ts
```
