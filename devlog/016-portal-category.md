# 016 - Portal 카테고리 개선

## 개요
라벨을 packages로 변경, 패키지 폴더 정렬 구현

## 변경 사항

### 1. 라벨 변경
'portal' -> 'packages'로 표시
- `src/explorer/models/categoryHandlers.js` - PortalCategory 생성자 수정

### 2. 패키지 폴더 내 정렬 및 표시 개선
- `portal.json` -> `info`로 라벨 변경
- 정렬 순서: info > app > route > controller > model > 기타
- `src/explorer/fileExplorerProvider.js` - 패키지 폴더 감지 및 정렬 로직 추가
