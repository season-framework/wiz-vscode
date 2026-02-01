# 026 - 드래그 앤 드롭 기능 추가

## 개요
일반 파일/폴더에 대해 드래그 앤 드롭으로 이동 지원

## 요구사항
일반 파일/폴더에 대해 드래그 앤 드롭으로 이동 지원

## 구현 내용

### 1. WizDragAndDropController 클래스 (`src/explorer/wizDragAndDropController.js`)
- `handleDrag`: 드래그 가능한 아이템 필터링 및 데이터 설정
- `handleDrop`: 드롭 시 파일/폴더 이동 처리
- `isDraggable`: 드래그 가능 여부 판단
- `isDropTarget`: 드롭 대상 유효성 확인

### 2. 드래그/드롭 제외 대상 (contextValue)
- `appGroup`, `appItem`, `portalAppGroup`, `portalRouteGroup`, `routeGroup`, `category`

### 3. 허용 대상
- `file`, `folder` (일반 파일/폴더만)

### 4. 추가 기능
- 덮어쓰기 확인 다이얼로그
- 자기 자신 안으로 이동 방지
