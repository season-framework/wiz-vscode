# 054. 키보드 네비게이션 개선 (v1.1.1)

## 개요
앱 파일 전환 단축키의 사용성을 개선하였다. 기존에 동작 신뢰도가 낮았던 `Alt+1~6` 단축키를 제거하고, mac 기준 `Opt+A/S/T` 중심의 흐름으로 정리했다.

## 변경 사항

### 1. 키보드 단축키 체계 개편 (`package.json`, `src/extension.js`)
- `wizExplorer.navigatePrevious`, `wizExplorer.navigateNext`, `wizExplorer.openInSplit` 커맨드를 추가했다.
- mac 기준 단축키를 다음으로 적용했다.
  - `Opt+A`: 이전 파일 타입으로 이동
  - `Opt+S`: 다음 파일 타입으로 이동
  - `Opt+T`: 현재 문서를 오른쪽 분할 에디터에 열기
- 기존 `Alt+1~6` (`switch.info/ui/component/scss/api/socket`) keybinding 기여를 제거했다.
- 새 단축키 커맨드를 Command Palette 노출에서 제외(`when: false`)해 불필요한 UI 노출을 줄였다.
- 단축키 입력만으로도 확장이 활성화되도록 `onCommand` activation event를 추가했다.

### 2. 파일 타입 순환 이동 로직 추가/정비 (`src/services/app/navigationManager.js`)
- 현재 활성 탭의 파일 타입을 판별하는 내부 로직을 추가했다(`_detectActiveFileType`).
- 파일 타입 순환 목록 계산 로직을 추가했다(`_getNavigableTypes`).
- `navigateFile(direction)` 메서드를 추가해 이전/다음 순환 이동을 구현했다.
- 사용자 요청에 따라 순환 대상에서 `INFO(app.json)`를 제외했다.
  - App 순환: `UI → Component → SCSS → API → Socket`
  - Route 순환: `Controller`만 대상
- `openCurrentInSplit()` 메서드를 추가해 현재 문서를 오른쪽 분할로 여는 동작을 구현했다.
