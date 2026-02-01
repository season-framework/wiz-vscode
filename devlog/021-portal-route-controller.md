# 021 - Portal Route Controller 경로 수정

## 개요
Route 에디터가 Portal 패키지 내 controller 폴더 참조하도록 수정

## 문제
Portal 패키지 내 Route 앱의 Controller 목록이 `src/controller`를 참조하는 문제

## 해결

`src/editor/editors/routeEditor.js`:
- `loadFormOptions()` 메소드 오버라이드
- 경로 구조 분석하여 Portal Route인 경우 `<package>/controller` 폴더 참조
- 일반 Route인 경우 기존 로직 유지

```javascript
// Portal Route: .../src/portal/<pkg>/route/<app>
if (path.basename(greatGrandParentDir) === 'portal') {
    controllerDir = path.join(grandParentDir, 'controller');
} else {
    controllerDir = WizPathUtils.findControllerDir(...);
}
```
