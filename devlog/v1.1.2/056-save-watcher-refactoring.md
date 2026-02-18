# 056. 저장 시 자동 빌드 로직 리팩토링 및 이벤트 방식 개선 (v1.1.2)

## 개요
`extension.js`에 인라인으로 작성되어 있던 저장 시 자동 빌드 관련 함수들을 `BuildManager`로 이동하고, `onWillSaveTextDocument` 기반 변경 감지 방식을 `onDidChangeTextDocument` 기반으로 변경하여 `wiz://` 커스텀 스킴에서 빌드가 트리거되지 않던 문제를 수정했다.

## 변경 사항

### 1. 인라인 함수 BuildManager로 이동
**파일:** `src/services/project/buildManager.js`, `src/extension.js`

- `extension.js`에 있던 6개 인라인 함수를 `BuildManager` 클래스의 private 메서드로 이동:
  - `getCurrentProjectSrcRoot()` → `_getCurrentProjectSrcRoot()`
  - `isWizWorkspaceForCurrentProject()` → `_isWizWorkspaceForCurrentProject()`
  - `resolveDocumentRealPath()` → `_resolveDocumentRealPath()`
  - `isInCurrentProjectSrc()` → `_isInCurrentProjectSrc()`
  - `isContentChangedFromDisk()` → 제거 (방식 변경으로 불필요)
  - `changedOnWillSaveDocuments` Set → `_editedDocuments` Set
- 3개 이벤트 핸들러(`onWillSave`, `onDidSave`, `onDidClose`)를 `registerSaveWatcher(context)` 공개 메서드로 캡슐화
- `extension.js`에서는 `buildManager.registerSaveWatcher(context)` 한 줄로 위임

### 2. 자동 빌드 이벤트 방식 변경
**파일:** `src/services/project/buildManager.js`

- **기존**: `onWillSaveTextDocument`에서 디스크 대비 변경 여부를 확인 후 Set에 기록
- **변경**: `onDidChangeTextDocument`에서 편집 발생 시 Set에 기록
- `wiz://` 커스텀 파일 시스템에서는 `onWillSaveTextDocument`가 발생하지 않는 경우가 있어, 스킴 무관하게 항상 발생하는 `onDidChangeTextDocument` 방식으로 변경

### 3. extension.js 구조 정리
**파일:** `src/extension.js`

- `updateProjectRoot()` monkey-patching 패턴 제거 → 단일 함수로 통합하여 Service managers 상태 동기화 코드 포함
- 미사용 `fs`, `cp` import 제거
- 초기화 순서 재배치: Service Managers → Workspace State Sync → Tree View

## 기대 효과

1. `wiz://` 탭에서 파일 저장 시 자동 빌드가 정상 동작
2. `extension.js`의 비즈니스 로직이 서비스 계층으로 완전 분리되어 관심사 분리 원칙 준수
3. monkey-patching 제거로 코드 가독성 및 유지보수성 향상
