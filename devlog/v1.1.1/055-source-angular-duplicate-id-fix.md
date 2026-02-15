# 055. Source Angular 트리 ID 중복 버그 수정 (v1.1.1)

## 개요
Wiz 사이드바의 source 트리에서 `angular/libs` 및 `angular/styles`가 중복 등록되어 `source/angular` 확장 시 발생하던 TreeItem ID 충돌 오류를 수정했습니다.

## 변경 사항

### 1. Source Angular 하위 노드 중복 제거
- `src/explorer/fileExplorerProvider.js`에서 `src/angular` 디렉터리 확장 시 `libs`, `styles` 폴더를 자식 목록에서 제외하도록 처리했습니다.
- `models/categoryHandlers.js`의 source 루트 승격 로직(angular/libs, angular/styles 노출)과 충돌하지 않도록 조정했습니다.

### 2. 오류 원인 정리
- 기존에는 동일 경로(`/src/angular/libs`, `/src/angular/styles`)가 source 루트와 angular 하위에 동시에 생성되어 VS Code TreeItem ID 중복 에러를 유발했습니다.
- 이번 수정으로 동일 경로 TreeItem이 1회만 생성되어 사이드바 탐색이 정상 동작합니다.
