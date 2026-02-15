# 051. 자동 빌드 조건 처리 개선

## 개요
Wiz 탭 활성화 이후 비대상 파일 저장 시에도 빌드가 실행되던 문제를 수정하고, 자동 빌드 트리거 조건을 현재 선택 프로젝트 기준으로 제한했습니다.

## 변경 사항

### 1. Wiz 워크스페이스 유효성 체크 추가
**파일:** `src/extension.js`

- `project/{currentProject}/src` 경로 존재 여부를 기반으로 자동 빌드 가능 상태를 판단하는 `isWizWorkspaceForCurrentProject()` 함수 추가
- Wiz 프로젝트 구조가 아닌 경우 저장 이벤트에서 즉시 return 하도록 처리

### 2. 저장 문서 실제 경로 해석 로직 통합
**파일:** `src/extension.js`

- `resolveDocumentRealPath(document)` 함수 추가
- `wiz://` 스킴은 `WizPathUtils.getRealPathFromUri()`로 실제 경로를 복원
- `file://` 스킴은 `uri.fsPath` 사용
- 지원하지 않는 스킴은 자동 빌드 대상에서 제외

### 3. 현재 선택 프로젝트의 src 하위 파일만 빌드
**파일:** `src/extension.js`

- `getCurrentProjectSrcRoot()` 함수로 현재 선택 프로젝트의 빌드 대상 루트(`project/{currentProject}/src`) 계산
- `isInCurrentProjectSrc(filePath)` 함수로 저장 파일이 해당 루트 하위인지 검증
- 저장 이벤트(`onDidSaveTextDocument`)에서 아래 조건을 모두 만족할 때만 `buildManager.triggerBuild()` 실행
  - Wiz 워크스페이스 유효
  - 저장 문서의 실제 경로 확인 가능
  - 현재 선택 프로젝트의 `src` 하위 파일

## 기대 효과

1. Wiz 탭 활성화 여부와 관계없이 비대상 파일 저장 시 불필요한 빌드 방지
2. 현재 선택된 프로젝트 범위를 벗어난 파일 저장 시 자동 빌드 차단
3. 실제 빌드가 필요한 소스 변경에만 빌드가 수행되어 개발 워크플로우 안정성 향상
