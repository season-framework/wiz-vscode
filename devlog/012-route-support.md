# 012 - Route 앱 지원 추가

## 개요
src/route 하위 폴더를 앱으로 인식

## 요구사항
`src/route` 하위 폴더들을 앱으로 인식, Info/Controller 탭만 표시

## 구현 내용

### 1. 상수 확장 (`src/core/constants.js`)
- `APP_TYPES`에 'route' 추가
- `FLAT_APP_TYPES` 배열 추가 (접두어 없는 플랫 구조)
- `FILE_TYPE_MAPPING`에 controller 타입 추가
- `APP_INDICATOR_FILES`에 `controller.py` 추가

### 2. 경로 파싱 확장 (`src/core/pathUtils.js`)
- `parseAppFolder()` - 부모 폴더가 'route'인 경우 category를 'route'로 설정

### 3. 트리뷰 처리 (`src/explorer/fileExplorerProvider.js`)
- `FLAT_APP_TYPES` 폴더 하위 디렉토리를 앱으로 표시
- 클릭 시 `wizExplorer.openAppEditor` 커맨드 실행

### 4. 컨텍스트 추적 (`src/editor/appContextListener.js`)
- `wizExplorer:appCategory` 컨텍스트 키 추가

### 5. 메뉴 조건 분기 (`package.json`)
- Route: Info, Controller 탭만 표시
- 일반 앱: UI, Component, SCSS, API, Socket 탭 표시
