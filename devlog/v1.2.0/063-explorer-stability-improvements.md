# 063. 탐색기 안정성 개선 (v1.2.0)

## 개요
트리 탐색기의 무한 루프 방지, 디바운스 refresh, auto-reveal 안전장치 등 안정성 관련 개선 사항을 적용하였다.

## 변경 사항

### 1. 디바운스 refresh (`_deferRefresh`)
- `src/explorer/fileExplorerProvider.js`에 `_deferRefresh()` 메서드 추가
- 가상 폴더 생성 후 다중 `setTimeout → refresh` 캐스케이드를 방지
- 100ms 디바운스로 연속 호출 시 마지막 호출만 실행

### 2. findItem 무한 루프 방지
- `findItem()` 메서드에 `MAX_LOOP = 50` 제한 추가
- `wizRoot` 경로를 추가 종료 조건으로 사용하여 탐색 범위 제한

### 3. 가상 폴더 생성 제한
- 허용되는 가상 폴더 이름을 `allowedVirtualFolders` 배열로 제한
- App Types + 공통 폴더 (model, controller, service, assets, libs, styles, route)만 자동 생성 허용
- 임의 폴더의 무분별한 자동 생성 방지

### 4. Auto-Reveal 안전장치
- `onDidChangeActiveTextEditor`에서 `isDirty` 문서는 auto-reveal 건너뛰기
- `findItem`에 500ms timeout 적용 (`Promise.race`)
- 파일 존재 여부 확인 후 `treeView.reveal()` 호출

### 5. 프로젝트 전환 시 상태 초기화
- `extension.js`에서 프로젝트 전환 시 `buildManager.clearEditedDocuments()` 호출
- 이전 프로젝트의 편집 추적 Set이 잔존하여 발생하는 불필요한 빌드 방지

## 관련 파일
- `src/explorer/fileExplorerProvider.js`
- `src/extension.js`
- `src/services/project/buildManager.js`
