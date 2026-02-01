# 029 - Portal App 에디터 경로 개선

## 개요
Portal App 탭 상단 경로에 패키지명 표시

## 요구사항
Portal App 편집 시 상단 탭 라벨 경로에 `[portal-app]` 대신 실제 패키지명 표시

## 구현

`src/core/uriFactory.js`:
- `fromAppPath()` 메서드 개선
- `category`가 `portal-app`인 경우 경로를 파싱하여 패키지명 추출
- 라벨 형식: `[패키지명] [파일타입] 앱이름` (예: `[dizest] [UI] home`)
