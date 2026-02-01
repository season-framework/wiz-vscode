# 019 - Portal App 에디터 구현

## 개요
Portal 패키지 내 App 전용 Info 에디터 구현

## 요구사항
Portal 패키지(`src/portal/<package>/app/*`) 내 앱을 위한 전용 Info 에디터

## 구현 내용

### 1. PortalAppEditor 클래스 (`src/editor/editors/portalAppEditor.js`)
- AppEditor를 상속하여 Portal App 전용 로직 구현
- `mode: 'portal'` 자동 설정
- Namespace → Folder Name → ID 자동 동기화
- Controller는 해당 패키지의 `controller` 폴더에서 로드

### 2. UI 필드
- Title, Namespace, Category, View URI, Controller
- ID와 Template 필드는 자동 관리되어 UI에서 숨김

### 3. 자동 동기화 로직
- Namespace 변경 시 폴더명과 ID가 동일하게 변경
- Template은 `wiz-portal-<package>-<namespace>` 형식으로 자동 생성
