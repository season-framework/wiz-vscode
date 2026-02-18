# 058. 무한루프 방지 및 트리 안정성 개선 (v1.1.3)

## 개요
가상 폴더 확장 시 `getChildren()` → `refresh()` 재귀 호출로 인한 무한루프/메모리 고갈 문제를 수정하고, 트리 안정성을 전반적으로 개선.

## 변경 사항

### 1. 디바운스된 refresh 메커니즘 추가 (`fileExplorerProvider.js`)
- `_deferRefresh()` 메서드 신규 추가
- `clearTimeout` + 단일 타이머(100ms)로 여러 가상 폴더 동시 확장 시 캐스케이드 refresh 방지
- 기존 `setTimeout(() => this.refresh(), 50)` 패턴을 `this._deferRefresh()`로 통일
- `_pendingRefreshTimer` 필드 추가하여 타이머 상태 관리

### 2. Portal App/Route 가상 폴더 생성 시 early return
- Portal App (`app` 폴더) 가상 폴더 생성 후 `_deferRefresh()` + `return []`로 즉시 반환
- Portal Route (`route` 폴더) 가상 폴더 생성 후 동일하게 early return 적용
- 기존: 디렉토리 생성 후 fallthrough → 불필요한 로직 실행 및 잠재적 오류

### 3. `findItem()` 순회 범위 제한
- 기존: `workspaceRoot`만 종료 조건 → `.github/`, `config/` 등 외부 경로에서 `/`까지 불필요 순회
- 수정: `wizRoot`도 종료 조건에 추가하여 탐색 범위 제한

### 4. BuildManager 편집 추적 Set 정리
- `clearEditedDocuments()` public 메서드 추가 (`buildManager.js`)
- `updateProjectRoot()`에서 프로젝트 전환 시 호출하여 `_editedDocuments` Set 누적 방지 (`extension.js`)
