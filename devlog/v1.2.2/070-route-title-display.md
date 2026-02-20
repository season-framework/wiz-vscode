# 070. Route 앱 트리 Title 표시 (v1.2.2)

## 개요
Source Route 및 Portal Route/App이 파일 트리에 표시될 때 ID(폴더명) 대신 Title을 메인 라벨로 표시하도록 변경.

## 변경 사항

### 1. Flat App Types Title 표시 (`src/explorer/fileExplorerProvider.js`)
- `FLAT_APP_TYPES` (route 등) 하위 디렉토리 아이템에서 `app.json`을 읽어 `title` 필드 확인
- Title 존재 시: Label을 `title`로 설정, 원래 ID(폴더명)는 Description으로 이동
- Title 부재 시: 기존대로 ID를 Label로 사용
- 예시: `사용자 관리` `user_management` (title이 메인, id가 회색 설명)

### 2. Portal App Title 표시 (`src/explorer/fileExplorerProvider.js`)
- Portal App 폴더(`src/portal/{package}/app/`) 하위 아이템에도 동일한 title 표시 로직 추가
- `app.json`에서 title을 읽어 Label로 설정, namespace(폴더명)는 Description으로 이동
- 기존 `appGroupItem.js`의 Standard App title 표시와 동일한 UX 제공

### 3. 적용 범위
- Source Route: `src/route/{id}/` → title 표시
- Portal Route: `src/portal/{package}/route/{id}/` → title 표시 (FLAT_APP_TYPES 핸들링)
- Portal App: `src/portal/{package}/app/{namespace}/` → title 표시
