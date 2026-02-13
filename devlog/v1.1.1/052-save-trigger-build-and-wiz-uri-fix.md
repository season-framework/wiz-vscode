# 052. 저장 트리거 빌드 조건 및 Wiz URI 호환성 개선 (v1.1.1)

## 개요
저장 이벤트 기반 자동 빌드가 실제 수정이 없어도 실행되던 문제를 해결하고, `wiz://` 가상 URI가 외부 확장에서 파일 경로로 처리될 때 발생하던 `ENOENT` 오류를 줄이기 위해 URI 구조와 경로 해석 로직을 함께 개선했다.

## 변경 사항

### 1. 자동 빌드 트리거 조건 정교화
- `src/extension.js`에서 자동 빌드 판단 기준을 단순 save 이벤트에서 **저장 직전 실제 변경 여부** 기준으로 변경했다.
- `onWillSaveTextDocument` 시점에 현재 문서 텍스트와 디스크 파일 내용을 비교(`isContentChangedFromDisk`)해, 실제 변경이 있는 문서만 빌드 후보로 기록한다.
- `onDidSaveTextDocument`에서는 직전 기록된 문서에 대해서만 `buildManager.triggerBuild()`를 실행하도록 분기했다.
- `onDidCloseTextDocument`에서 후보 기록을 정리해 stale 상태가 남지 않도록 했다.

### 2. Wiz 가상 URI 구조 개선
- `src/core/uriFactory.js`에서 `wiz://` URI 생성 시 `path`를 가상 라벨 경로가 아닌 **실제 파일 경로 기반**으로 구성하도록 변경했다.
- 표시 이름은 `query`의 `label` 파라미터로 분리하고, 기존 real path 전달(`path` base64)도 유지해 역호환성을 보장했다.
- 이 변경으로 저장 훅을 가진 외부 확장이 URI의 path를 직접 참조해도 실제 파일에 접근 가능하도록 개선했다.

### 3. URI 해석/타입 감지 호환성 보강
- `src/core/pathUtils.js`의 `getRealPathFromUri()`에 direct path fallback(Strategy 3)을 추가해 신/구 URI 포맷 혼재 시에도 실제 경로 해석이 가능하도록 보완했다.
- `src/editor/appContextListener.js`에서 `wiz` 문서 파일 타입 감지 시 `query.label` 우선, real path 기반 파일명 fallback, legacy path fallback 순서로 처리하도록 보강했다.
