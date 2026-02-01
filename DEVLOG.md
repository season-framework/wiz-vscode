# Wiz VSCode Extension - Development Log

## 개요
Wiz Framework 프로젝트를 위한 VS Code 익스텐션 개발 이력입니다.

---

## 작업 순서

### 초기 개발 (기반 기능 구현)
1. **프로젝트 초기 설정** - VS Code 익스텐션 프로젝트 생성, package.json 구성
2. **Tree View 구현** - Wiz Explorer 사이드바, source/portal/project 카테고리 구조
3. **File System Provider 구현** - wiz:// 커스텀 URI 스킴, 가상 파일 시스템
4. **App Editor Provider 구현** - App 폴더 클릭 시 UI 파일 열기
5. **Info Editor 구현** - Webview 기반 app.json 편집기
6. **New App 기능 구현** - 새 App 생성 다이얼로그 및 폴더/파일 생성
7. **Delete 기능 구현** - App 및 파일/폴더 삭제 기능
8. **Alt+1-6 단축키 구현** - 탭 전환 키보드 단축키 추가

### 버그 수정 및 개선
9. **Alt+1-6 단축키 버그 수정** - 탭 전환 대신 숫자가 입력되는 문제 해결
10. **전체 코드 리팩토링** - Core 모듈 생성, 디자인 패턴 적용, 중복 코드 제거
11. **창 분할 시 Wiz 탭 복원 버그 수정** - URI 인코딩 및 Webview 상태 복원 구현

### Route 앱 지원
12. **Route 앱 지원 추가** - src/route 하위 폴더를 앱으로 인식
13. **Route Info 에디터 구현** - Route 전용 정보 편집 UI 생성
14. **Namespace 변경 시 폴더명/ID 자동 변경** - Info 에디터에서 namespace 수정 시 연동
15. **Route 앱 UI 개선** - 아이콘 제거, 탭 순서 변경, 기본 파일을 Controller로 설정

### Portal/Packages 개선
16. **Portal 카테고리 개선** - 라벨을 packages로 변경, 패키지 폴더 정렬 구현
17. **Portal Info 에디터 구현** - portal.json 전용 Webview 에디터 추가

### 에디터 코드 리팩토링
18. **AppEditorProvider 분리** - 기능별 에디터 클래스 분리 및 모듈화

### Portal App 에디터 및 생성 기능
19. **Portal App 에디터 구현** - Portal 패키지 내 App 전용 Info 에디터 구현
20. **Portal App 생성 기능** - app 폴더 컨텍스트 메뉴에서 새 Portal App 생성
21. **Portal Route Controller 경로 수정** - Route 에디터가 Portal 패키지 내 controller 폴더 참조하도록 수정

### UI/UX 개선
22. **Portal 패키지 폴더 아이콘 통일** - app, route, controller, model, assets, libs, styles 폴더에 일관된 아이콘 적용
23. **탐색기 상단 UI 정리** - "WIZ EXPLORER" 타이틀 제거, 프로젝트명만 표시, 파일/폴더 추가 버튼 제거
24. **Source app/route 그룹 제거** - Source 카테고리에서 존재하지 않는 route 그룹 제거

---

## 상세 작업 내역

### 초기 개발 단계

#### 1. 프로젝트 초기 설정
- VS Code 익스텐션 프로젝트 생성
- `package.json` 구성 (activationEvents, contributes 등)
- 기본 디렉토리 구조 설정

#### 2. Tree View 구현
- Activity Bar에 Wiz Explorer 아이콘 추가
- `FileExplorerProvider` 클래스 구현
- source / portal / project 3개 카테고리 구조
- 파일/폴더 트리 아이템 표시

#### 3. File System Provider 구현
- `wiz://` 커스텀 URI 스킴 등록
- `WizFileSystemProvider` 클래스 구현
- 가상 경로에서 실제 파일 읽기/쓰기

#### 4. App Editor Provider 구현
- App 폴더(page.*, component.*, layout.*) 인식
- 클릭 시 UI 파일(view.pug/view.html) 자동 열기
- App 그룹별 트리 아이템 표시

#### 5. Info Editor 구현
- Webview 패널 기반 app.json 편집기
- 폼 UI (Title, Namespace, Category, Controller, Layout 등)
- 저장/삭제 기능

#### 6. New App 기능 구현
- App 그룹 컨텍스트 메뉴에 "New App" 추가
- 생성 다이얼로그 Webview
- 폴더 및 app.json 파일 자동 생성

#### 7. Delete 기능 구현
- App 및 파일/폴더 삭제 컨텍스트 메뉴
- 확인 다이얼로그
- 재귀적 폴더 삭제

#### 8. Alt+1-6 단축키 구현
- `package.json`에 keybindings 추가
- Info(1), UI(2), Component(3), SCSS(4), API(5), Socket(6) 탭 전환

---

### 9. Alt+1-6 단축키 버그 수정

**문제**: Alt+1-6 단축키가 탭 전환 대신 숫자를 입력하는 문제

**해결**:
- `package.json` keybindings의 `when` 조건에 `resourceScheme == 'wiz'` 추가
- `extension.js`의 `switchFile()` 함수 단순화 - 텍스트 에디터와 웹뷰 모두에서 경로를 올바르게 해석하도록 수정

**변경 파일**:
- `package.json` - keybindings when 조건 수정
- `src/extension.js` - switchFile(), resolveCurrentAppPath() 함수 개선

---

### 10. 전체 코드 리팩토링

**목표**: 중복 코드 제거, 객체 지향적 디자인 패턴 적용, 재사용 가능한 컴포넌트 분리

**새로 생성된 Core 모듈 (`/src/core/`)**:

| 파일 | 목적 |
|------|------|
| `constants.js` | `APP_TYPES`, `FILE_TYPE_MAPPING`, `FOLDER_ICONS` 등 중앙화 상수 |
| `pathUtils.js` | URI 경로 파싱, 앱 폴더 해석, 컨트롤러/레이아웃 로딩 |
| `fileUtils.js` | 파일 읽기/쓰기, 언어 감지, JSON 처리 |
| `uriFactory.js` | Wiz URI 생성 팩토리 |
| `webviewTemplates.js` | HTML 템플릿 및 스타일 생성 |
| `index.js` | 모듈 통합 export |

**적용된 디자인 패턴**:
1. **Configuration Object Pattern** - 상수 중앙화
2. **Utility/Helper Pattern** - 경로/파일 유틸리티
3. **Factory Pattern** - URI 생성
4. **Template Method Pattern** - HTML 템플릿
5. **Command Pattern** - 커맨드 등록 배열

**리팩토링된 파일**:
- `src/editor/wizFileSystemProvider.js` - WizPathUtils.getRealPathFromUri 사용
- `src/editor/appContextListener.js` - 중복 경로 파싱 로직 제거
- `src/editor/appEditorProvider.js` - WebviewTemplates 활용, 모듈화
- `src/explorer/appPatternProcessor.js` - APP_TYPES 상수 사용
- `src/explorer/treeItems/fileTreeItem.js` - FOLDER_ICONS 상수 사용
- `src/explorer/treeItems/appGroupItem.js` - createAppItem() 헬퍼 메소드 추가
- `src/extension.js` - 커맨드 배열 패턴, resolveCurrentAppPath() 헬퍼

---

### 11. 창 분할 시 Wiz 탭 복원 버그 수정

**문제**: 에디터 창 분할 시 wiz:// 관련 info/ui/component 탭이 새 창에서 컨텍스트를 잃어버리는 문제

**원인**:
1. URI 쿼리 파라미터의 Base64 인코딩 문자열이 URL 인코딩되지 않음
2. Info 탭(Webview)에 상태 복원 로직 없음

**해결**:
1. `src/core/uriFactory.js` - `encodeURIComponent()` 적용
2. `src/editor/appEditorProvider.js` - `reviveInfoEditor()` 메소드 추가, `vscode.setState()` 호출
3. `src/extension.js` - `vscode.window.registerWebviewPanelSerializer('wizAppInfo', ...)` 등록

---

### 12. Route 앱 지원 추가

**요구사항**: `src/route` 하위 폴더들을 앱으로 인식, Info/Controller 탭만 표시

**구현 내용**:

1. **상수 확장** (`src/core/constants.js`):
   - `APP_TYPES`에 'route' 추가
   - `FLAT_APP_TYPES` 배열 추가 (접두어 없는 플랫 구조)
   - `FILE_TYPE_MAPPING`에 controller 타입 추가
   - `APP_INDICATOR_FILES`에 `controller.py` 추가

2. **경로 파싱 확장** (`src/core/pathUtils.js`):
   - `parseAppFolder()` - 부모 폴더가 'route'인 경우 category를 'route'로 설정

3. **트리뷰 처리** (`src/explorer/fileExplorerProvider.js`):
   - `FLAT_APP_TYPES` 폴더 하위 디렉토리를 앱으로 표시
   - 클릭 시 `wizExplorer.openAppEditor` 커맨드 실행

4. **컨텍스트 추적** (`src/editor/appContextListener.js`):
   - `wizExplorer:appCategory` 컨텍스트 키 추가

5. **메뉴 조건 분기** (`package.json`):
   - Route: Info, Controller 탭만 표시
   - 일반 앱: UI, Component, SCSS, API, Socket 탭 표시

---

### 13. Route Info 에디터 구현

**구현 내용** (`src/editor/appEditorProvider.js`):

```javascript
generateRouteInfoHtml(data, controllers, appPath) {
    // Title, ID, Route, Category, Preview URL, Controller 필드
}
```

**지원 필드**:
- Title
- ID
- Route
- Category
- Preview URL (viewuri)
- Controller (Select)

---

### 14. Namespace 변경 시 폴더명/ID 자동 변경

**요구사항**: Info 에디터에서 namespace 변경 시 폴더명과 app.json의 id도 함께 변경

**구현** (`src/editor/appEditorProvider.js` - `handleUpdate()`):
- Route가 아닌 앱에서 namespace가 변경된 경우:
  1. 폴더명을 `{category}.{newNamespace}`로 변경
  2. app.json의 id를 동일하게 업데이트
  3. 파일 탐색기 새로고침
  4. 기존 웹뷰 닫기

---

### 15. Route 앱 UI 개선

**변경 사항**:

1. **아이콘 제거**: Route 하위 앱들에서 폴더 아이콘 설정 제거
   - `src/explorer/fileExplorerProvider.js` - `item.setFolderIcon()` 호출 제거

2. **탭 순서 변경**: Info -> Controller 순서로 표시
   - `package.json` - Controller를 `navigation@2`로 변경

3. **기본 파일 변경**: Route 앱 클릭 시 Controller 파일 열기
   - `src/editor/appEditorProvider.js` - `openEditor()` 메소드에서 groupType이 'route'인 경우 controller 파일 우선

---

### 16. Portal 카테고리 개선

**변경 사항**:

1. **라벨 변경**: 'portal' -> 'packages'로 표시
   - `src/explorer/models/categoryHandlers.js` - PortalCategory 생성자 수정

2. **패키지 폴더 내 정렬 및 표시 개선**:
   - `portal.json` -> `info`로 라벨 변경
   - 정렬 순서: info > app > route > controller > model > 기타
   - `src/explorer/fileExplorerProvider.js` - 패키지 폴더 감지 및 정렬 로직 추가

---

### 17. Portal Info 에디터 구현

**요구사항**: `portal.json` 파일을 클릭할 때 일반 텍스트 에디터 대신 전용 UI 에디터로 표시

**구현 내용**:

1. **에디터 등록** (`src/editor/appEditorProvider.js`):
   - `openPortalInfoEditor()` 메소드 추가
   - Package, Title, Version 필드만 UI에 표시
   - `use_*` 필드들은 UI에서 숨기고 저장 시 자동으로 `true`로 설정

2. **트리뷰 연동** (`src/explorer/fileExplorerProvider.js`):
   - `portal.json` 파일 감지 시 라벨을 `info`로 변경
   - 클릭 시 `wizExplorer.openPortalInfo` 커맨드 실행

3. **커맨드 등록** (`src/extension.js`):
   - `wizExplorer.openPortalInfo` 커맨드 등록

**저장 시 자동 적용되는 필드**:
```javascript
{
    package: "...",
    title: "...",
    version: "...",
    use_app: true,
    use_widget: true,
    use_route: true,
    use_libs: true,
    use_styles: true,
    use_assets: true,
    use_controller: true,
    use_model: true
}
```

---

### 18. AppEditorProvider 분리 (에디터 코드 리팩토링)

**목표**: 기능별로 뒤섞여 있던 AppEditorProvider 코드를 기능 단위로 분리하여 유지보수성 향상

**새로 생성된 에디터 모듈 (`/src/editor/editors/`)**:

| 파일 | 역할 |
|------|------|
| `editorBase.js` | 모든 에디터의 공통 기본 클래스 (패널 생성/종료/메시지 처리) |
| `appEditor.js` | 일반 App (Page, Widget 등) 정보 수정 에디터 |
| `routeEditor.js` | Route 앱 전용 정보 수정 에디터 (AppEditor 상속) |
| `portalEditor.js` | Portal Package (portal.json) 정보 수정 에디터 |
| `portalAppEditor.js` | Portal App 전용 정보 수정 에디터 (AppEditor 상속) |
| `createEditor.js` | 새 App 생성 에디터 |
| `createPortalAppEditor.js` | Portal App 생성 에디터 |

**적용된 디자인 패턴**:
1. **상속 패턴** - EditorBase → AppEditor → RouteEditor
2. **Facade 패턴** - AppEditorProvider가 각 에디터 인스턴스 관리
3. **Template Method 패턴** - 공통 로직(패널 생성)은 부모에서, 세부 로직(HTML 생성)은 자식에서 처리

**리팩토링된 AppEditorProvider**:
- 기존 500줄+ 코드에서 130줄로 대폭 축소
- HTML 생성, 메시지 핸들링 로직을 각 에디터 클래스로 위임
- `activeEditor` 프로퍼티로 현재 활성 에디터 인스턴스 추적

**디렉토리 구조 변경**:
```
src/editor/
├── editors/                    # 신규 디렉토리
│   ├── editorBase.js          # 공통 기본 클래스
│   ├── appEditor.js           # 일반 앱 에디터
│   ├── routeEditor.js         # Route 에디터
│   ├── portalEditor.js        # Portal 에디터
│   ├── portalAppEditor.js     # Portal App 에디터
│   ├── createEditor.js        # 앱 생성 에디터
│   └── createPortalAppEditor.js # Portal App 생성 에디터
├── appEditorProvider.js       # Facade (리팩토링됨)
├── appContextListener.js
└── wizFileSystemProvider.js
```

---

### 19. Portal App 에디터 구현

**요구사항**: Portal 패키지(`src/portal/<package>/app/*`) 내 앱을 위한 전용 Info 에디터

**구현 내용**:

1. **PortalAppEditor 클래스** (`src/editor/editors/portalAppEditor.js`):
   - AppEditor를 상속하여 Portal App 전용 로직 구현
   - `mode: 'portal'` 자동 설정
   - Namespace → Folder Name → ID 자동 동기화
   - Controller는 해당 패키지의 `controller` 폴더에서 로드

2. **UI 필드**:
   - Title, Namespace, Category, View URI, Controller
   - ID와 Template 필드는 자동 관리되어 UI에서 숨김

3. **자동 동기화 로직**:
   - Namespace 변경 시 폴더명과 ID가 동일하게 변경
   - Template은 `wiz-portal-<package>-<namespace>` 형식으로 자동 생성

---

### 20. Portal App 생성 기능

**요구사항**: Portal 패키지의 `app` 폴더에서 우클릭 → "새 앱 만들기" 기능

**구현 내용**:

1. **CreatePortalAppEditor 클래스** (`src/editor/editors/createPortalAppEditor.js`):
   - Namespace (필수), Title, Category, View URI, Controller 입력 폼
   - 생성 시 폴더 구조 및 기본 파일 자동 생성

2. **트리뷰 컨텍스트** (`src/explorer/fileExplorerProvider.js`):
   - `app` 폴더에 `portalAppGroup` contextValue 설정
   - `layers` 아이콘 적용 (Source의 page/component 그룹과 동일)

3. **메뉴 등록** (`package.json`):
   - `portalAppGroup` 컨텍스트에서 "New Portal App" 메뉴 표시

4. **생성되는 파일 구조**:
```
src/portal/<package>/app/<namespace>/
├── app.json      # id, mode, title, namespace, category, viewuri, controller, template
├── view.pug
├── view.scss
└── view.ts
```

---

### 21. Portal Route Controller 경로 수정

**문제**: Portal 패키지 내 Route 앱의 Controller 목록이 `src/controller`를 참조하는 문제

**해결** (`src/editor/editors/routeEditor.js`):
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

---

### 22. Portal 패키지 폴더 아이콘 통일

**요구사항**: Portal 패키지 내 특수 폴더들에 Source 디렉토리와 동일한 아이콘 적용

**구현** (`src/explorer/fileExplorerProvider.js`, `src/core/constants.js`):

| 폴더 | 아이콘 |
|------|--------|
| app | `layers` |
| route | `circuit-board` |
| controller | `symbol-method` |
| model | `symbol-method` |
| assets | `folder-library` |
| libs | `library` |
| styles | `symbol-color` |

---

### 23. 탐색기 상단 UI 정리

**변경 사항**:

1. **타이틀 변경** (`package.json`):
   - viewsContainers title: "Wiz Explorer" → "Project"

2. **트리뷰 타이틀** (`src/extension.js`):
   - `treeView.title`: "Project: main" → "main" (프로젝트명만 표시)

3. **상단 버튼 정리** (`package.json`):
   - "새 파일", "새 폴더" 버튼 제거
   - "새로고침", "프로젝트 전환" 버튼만 유지

---

### 24. Source app/route 그룹 제거

**문제**: Source 카테고리에 존재하지 않는 `app/route` 그룹이 표시되는 문제

**해결** (`src/explorer/appPatternProcessor.js`):
- `TYPES` getter에서 `FLAT_APP_TYPES` 필터링
- Route는 플랫 구조이므로 app 하위 그룹으로 표시하지 않음

```javascript
static get TYPES() {
    return APP_TYPES.filter(type => !FLAT_APP_TYPES.includes(type));
}
```

---

## 주요 코드 변경 이력

### src/core/ (신규)
```
src/core/
├── constants.js      # 중앙화된 상수
├── pathUtils.js      # 경로 유틸리티
├── fileUtils.js      # 파일 유틸리티
├── uriFactory.js     # URI 팩토리
├── webviewTemplates.js # HTML 템플릿
└── index.js          # 모듈 exports
```

### src/editor/
- `appEditorProvider.js` - Facade 패턴, 에디터 인스턴스 관리
- `appContextListener.js` - appCategory 컨텍스트 추가
- `wizFileSystemProvider.js` - 경로 유틸리티 사용
- `editors/editorBase.js` - 공통 Webview 패널 관리
- `editors/appEditor.js` - 일반 앱 Info 에디터
- `editors/routeEditor.js` - Route 앱 Info 에디터
- `editors/portalEditor.js` - Portal Info 에디터
- `editors/createEditor.js` - 앱 생성 에디터

### src/explorer/
- `fileExplorerProvider.js` - Flat App Types, 패키지 폴더 정렬
- `models/categoryHandlers.js` - packages 라벨 변경
- `appPatternProcessor.js` - 상수 사용

### package.json
- keybindings when 조건 수정
- Controller 커맨드 추가
- 메뉴 조건 분기 (appCategory)

---

## 현재 지원 기능

### App 타입
| 타입 | 위치 | 탭 구성 |
|------|------|---------|
| page | app/page.* | Info, UI, Component, SCSS, API, Socket |
| component | app/component.* | Info, UI, Component, SCSS, API, Socket |
| layout | app/layout.* | Info, UI, Component, SCSS, API, Socket |
| route | route/* | Info, Controller |

### 키보드 단축키
| 단축키 | 기능 |
|--------|------|
| Alt+1 | Info 탭 |
| Alt+2 | UI / Controller 탭 |
| Alt+3 | Component 탭 |
| Alt+4 | SCSS 탭 |
| Alt+5 | API 탭 |
| Alt+6 | Socket 탭 |

### 트리뷰 구조
```
Project (프로젝트명)
├── source (src/)
│   ├── page 그룹
│   ├── component 그룹
│   ├── layout 그룹
│   ├── route/
│   ├── controller/
│   └── 기타 폴더들
├── packages (src/portal/)
│   └── 패키지명/
│       ├── info (portal.json)
│       ├── app/           # 아이콘: layers
│       ├── route/         # 아이콘: circuit-board
│       ├── controller/    # 아이콘: symbol-method
│       ├── model/         # 아이콘: symbol-method
│       ├── assets/        # 아이콘: folder-library
│       ├── libs/          # 아이콘: library
│       ├── styles/        # 아이콘: symbol-color
│       └── ...
└── project (루트/)
```

---

## 향후 개선 사항

- [ ] 패키지 생성 기능
- [x] Route 앱 생성 기능 (Portal Route 지원)
- [x] Portal App 생성 기능
- [ ] 검색 기능
- [ ] Git 상태 표시
- [ ] 프리뷰 기능 연동
