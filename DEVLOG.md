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
- `appEditorProvider.js` - Route 지원, Info 에디터, 상태 복원
- `appContextListener.js` - appCategory 컨텍스트 추가
- `wizFileSystemProvider.js` - 경로 유틸리티 사용

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
Wiz Explorer
├── source (src/)
│   ├── page 그룹
│   ├── component 그룹
│   ├── layout 그룹
│   └── 기타 폴더들
├── packages (src/portal/)
│   └── 패키지명/
│       ├── info (portal.json)
│       ├── app/
│       ├── route/
│       ├── controller/
│       ├── model/
│       └── ...
└── project (루트/)
```

---

## 향후 개선 사항

- [ ] 패키지 생성 기능
- [ ] Route 앱 생성 기능
- [ ] 검색 기능
- [ ] Git 상태 표시
- [ ] 프리뷰 기능 연동
