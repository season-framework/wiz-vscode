# 038. 커맨드 팔레트 기능 개선 및 버그 수정

## 개요
커맨드 팔레트 기능 추가 후 발생한 버그 수정 및 기능 개선 작업입니다.

## 변경 사항

### 1. 앱 생성 경로 수정 (205d9c1)
**문제**: `createPage/Component/Layout` 명령어가 잘못된 경로에 앱을 생성
- 기존: `src/page/page.myapp` (잘못된 경로)
- 수정: `src/app/page.myapp` 또는 `src/page.myapp` (올바른 경로)

**해결**: `getAppParentPath()` 헬퍼 함수 추가
- `src/app` 폴더가 있으면 그 안에 생성
- 없으면 `src` 폴더에 생성

### 2. createWidget 명령어 제거 (05cd40d)
- Widget은 별도 타입이 아니므로 명령어 제거

### 3. packages 하위 패키지 삭제 기능 추가 (e46e3c9)
- `portalPackage` contextValue를 삭제 메뉴 조건에 추가
- 패키지 우클릭 시 '삭제' 메뉴 표시

### 4. Route Info Editor 저장 버그 수정 (a9bd4e6)
**문제**: Route Info Editor에서 Update 버튼 클릭 시 저장되지 않음

**원인**: 
- 공통 `collectFormData()` 함수가 `namespace`, `ngRouting` 등 필드를 수집
- Route Editor는 `id`, `route` 등 다른 필드 사용
- `document.getElementById('namespace')`가 null 반환 → 에러 발생

**해결**: RouteEditor에서 자체 `collectFormData()` 함수 정의
```javascript
function collectFormData() {
    return {
        title: document.getElementById('title').value,
        id: document.getElementById('id').value,
        route: document.getElementById('route').value,
        category: document.getElementById('category').value,
        viewuri: document.getElementById('viewuri').value,
        controller: document.getElementById('controller').value
    };
}
```

### 5. 앱/라우트 생성 시 Package 선택 지원 (418af61)
커맨드 팔레트에서 `Wiz: Create New Page/Component/Layout/Route` 실행 시:

**패키지가 없는 경우**: 기존처럼 Source에 바로 생성

**패키지가 있는 경우**:
1. Source / Package 선택 다이얼로그 표시
2. **Source 선택**: src 또는 src/app에 생성 (기존 로직)
3. **Package 선택**: 패키지 목록에서 선택 → 해당 패키지의 `app/` 또는 `route/` 폴더에 생성

**추가된 헬퍼 함수**:
- `getPortalPackages()`: Portal 패키지 목록 조회
- `selectAppLocation()`: 앱 생성 위치 선택 (Source/Package)
- `selectRouteLocation()`: 라우트 생성 위치 선택 (Source/Package)

## 수정된 파일
- `src/extension.js` - 앱/라우트 생성 로직 개선
- `src/editor/editors/routeEditor.js` - Route 전용 collectFormData 함수 추가
- `package.json` - createWidget 명령어 제거, portalPackage 삭제 메뉴 추가

## 결론
커맨드 팔레트 기능의 안정성과 사용성이 크게 개선되었습니다. 특히 Source/Package 선택 기능으로 Portal 패키지 내 앱/라우트 생성이 편리해졌습니다.
