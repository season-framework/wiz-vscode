# 025 - Route 앱 생성 기능 구현

## 개요
src/route 및 portal route 폴더에서 새 Route 생성 기능 추가

## 요구사항
src/route 및 portal/route 폴더에서 우클릭 → "새 Route 만들기" 기능

## 구현 내용

### 1. CreateRouteAppEditor 클래스 (`src/editor/editors/createRouteAppEditor.js`)
- ID (폴더명), Title, Route Path, Category, Preview URL, Controller 입력 폼
- ID 유효성 검사: 영문 소문자 + 숫자만 허용
- `isPortalRoute` 플래그로 Portal/Source Route 구분

### 2. 트리뷰 컨텍스트
- Source route 폴더: `routeGroup` contextValue (`src/explorer/models/categoryHandlers.js`)
- Portal route 폴더: `portalRouteGroup` contextValue (`src/explorer/fileExplorerProvider.js`)

### 3. 메뉴 등록 (`package.json`)
- `routeGroup`: "New Route" 메뉴
- `portalRouteGroup`: "New Portal Route" 메뉴

### 4. 생성되는 파일 구조

```
src/route/<id>/   또는   src/portal/<pkg>/route/<id>/
├── app.json      # id, title, route, category, viewuri, controller
└── controller.py
```
