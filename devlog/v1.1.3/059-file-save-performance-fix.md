# 059. 파일 저장 후 트리 탐색 무한 로딩 및 빌드 성능 개선 (v1.1.3)

## 개요
파일 저장 후 탐색기에서 파일을 탐색할 때 무한 로딩이 발생하고, 연속 저장 시 빌드 프로세스가 과도하게 생성되는 성능 문제를 수정.

## 변경 사항

### 1. BuildManager 빌드 트리거 디바운싱 (`src/services/project/buildManager.js`)
- `triggerBuild()` 메서드에 **500ms 디바운스** 적용 (`_buildTimer` 필드 추가)
- 연속 저장 시 마지막 요청만 빌드 실행, 이전 대기 중인 타이머는 `clearTimeout`으로 취소
- 기존 `triggerBuild()`를 공개 디바운스 메서드 + `_execTriggerBuild()` 내부 실행 메서드로 분리
- 빌드 프로세스 종료 시 `process.kill(pid)` 사용으로 안정성 향상 (try-catch 래핑)

### 2. Auto-Reveal 무한 로딩 방지 (`src/extension.js`)
- `onDidChangeActiveTextEditor`에서 `editor.document.isDirty`인 경우 **reveal을 건너뛰도록** early return 추가
  - 저장 직후 dirty → clean 전환 중 중간 상태에서 트리 갱신 시도 방지
- `findItem()` 호출에 **500ms 타임아웃** 적용 (`Promise.race`)
  - 느린 파일 시스템 접근이나 깊은 경로 탐색으로 인한 블로킹 방지
- `treeView.reveal()` 호출 전 `fs.existsSync()` 검증 추가
  - 삭제/이동된 파일에 대한 reveal 시도 방지

### 3. 가상 폴더 생성 제한 (`src/explorer/fileExplorerProvider.js`)
- `getChildren()`의 catch-all 가상 폴더 생성 로직을 **허용 목록(allowlist) 방식**으로 변경
- `allowedVirtualFolders`: `APP_TYPES` + `model`, `controller`, `service`, `assets`, `libs`, `styles`, `route`
- 목록에 없는 임의 폴더는 디스크에 생성하지 않음 → 불필요한 refresh 체인 원천 차단

### 4. findItem() 루프 안전장치 (`src/explorer/fileExplorerProvider.js`)
- 부모 경로 순회 루프에 **최대 반복 횟수(50)** 제한 추가 (`loopCount`, `MAX_LOOP`)
- 비정상적으로 깊은 경로 구조에서도 무한 루프에 빠지지 않도록 보호
