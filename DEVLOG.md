# Wiz VSCode Extension - Development Log

## 개요
Wiz Framework 프로젝트를 위한 VS Code 익스텐션 개발 이력입니다.

---

## 작업 이력

> 각 작업의 상세 내용은 [devlog/](./devlog/) 디렉토리의 개별 파일을 참고하세요.

### v1.1.1 (ktw updated)

- [053](./devlog/v1.1.1/053-build-python-environment-fallback.md) - 자동 빌드 Python 환경 선택 및 Wiz 실행 경로 개선
- [052](./devlog/v1.1.1/052-save-trigger-build-and-wiz-uri-fix.md) - 저장 시 실제 변경 기반 자동 빌드 및 Wiz URI 호환성 개선
- [051](./devlog/v1.1.1/051-auto-build-condition-fix.md) - Wiz 탭 활성화 이후 자동 빌드 조건 처리 개선

### v1.1.0 (Configs & Improvements & Refactoring)

- [050](./devlog/v1.1.0/050-explorer-bug-fix.md) - 탐색기 오류 수정 및 정렬 개선
- [049](./devlog/v1.1.0/049-project-export-download.md) - 프로젝트 내보내기 다운로드 방식 변경
- [048](./devlog/v1.1.0/048-extension-refactoring.md) - Extension.js 비즈니스 로직 완전 분리
- [047](./devlog/v1.1.0/047-file-upload-feature.md) - 파일/폴더 업로드 기능 추가
- [046](./devlog/v1.1.0/046-copilot-category.md) - Copilot 카테고리 추가 (.github 폴더 접근)
- [045](./devlog/v1.1.0/045-folder-protection.md) - Source/Packages 루트 폴더 보호 기능
- [044](./devlog/v1.1.0/044-services-hierarchy-restructure.md) - Services 계층 구조 재구성 (7개 폴더 → 3개 계층 폴더)
- [043](./devlog/v1.1.0/043-services-refactoring.md) - Services 레이어 리팩토링 (비즈니스 로직 분리, 아키텍처 문서화)
- [042](./devlog/v1.1.0/042-core-refactoring.md) - Core 모듈 리팩토링 (AppCreator, ZipUtils, UploadWebview 클래스 분리)
- [041](./devlog/v1.1.0/041-download-upload-feature.md) - 다운로드/업로드 기능 구현 (.wizpkg, .wizapp 지원)
- [040](./devlog/v1.1.0/040-explorer-sorting-improvements.md) - 탐색기 정렬 및 표시 개선
- [039](./devlog/v1.1.0/039-config-category-update.md) - Config 카테고리 추가 및 탐색기 구조 개선

### v1.0.0 (Initial Release)

#### 커맨드 팔레트 지원
- [038](./devlog/v1.0.0/038-command-palette-improvements.md) - 커맨드 팔레트 기능 개선 및 버그 수정
- [037](./devlog/v1.0.0/037-command-palette.md) - 커맨드 팔레트에서 주요 기능 접근 지원

#### 프로젝트 내보내기/가져오기
- [036](./devlog/v1.0.0/036-project-export-import.md) - 프로젝트 내보내기 및 .wizproject 파일 가져오기 기능

#### View Type 기능
- [035](./devlog/v1.0.0/035-view-type-selection.md) - View Type 선택 기능 (pug/html), 기본 타입 HTML로 변경

#### 패키지 관리 및 빌드
- [034](./devlog/v1.0.0/034-package-management.md) - 패키지 생성/내보내기, 빌드 트리거, App/Route 생성 다이얼로그 방식 변경

#### 프로젝트 관리 기능
- [033](./devlog/v1.0.0/033-app-title-display.md) - App 트리 아이템 표기 개선
- [032](./devlog/v1.0.0/032-project-deletion.md) - 프로젝트 삭제 기능 추가
- [031](./devlog/v1.0.0/031-project-import.md) - 프로젝트 불러오기 기능 추가

#### 탐색기 기능 강화
- [030](./devlog/v1.0.0/030-auto-reveal.md) - 탐색기 자동 하이라이팅 구현
- [029](./devlog/v1.0.0/029-portal-app-path-label.md) - Portal App 에디터 경로 개선
- [028](./devlog/v1.0.0/028-portal-default-folders.md) - Portal 기본 폴더 자동 표시
- [027](./devlog/v1.0.0/027-multi-select.md) - 다중 선택 기능 추가
- [026](./devlog/v1.0.0/026-drag-and-drop.md) - 드래그 앤 드롭 기능 추가

#### Route 앱 생성 기능
- [025](./devlog/v1.0.0/025-route-creation.md) - Route 앱 생성 기능 구현

#### UI/UX 개선
- [024](./devlog/v1.0.0/024-source-route-group-removal.md) - Source app/route 그룹 제거
- [023](./devlog/v1.0.0/023-explorer-ui-cleanup.md) - 탐색기 상단 UI 정리
- [022](./devlog/v1.0.0/022-portal-folder-icons.md) - Portal 패키지 폴더 아이콘 통일

#### Portal App 에디터 및 생성 기능
- [021](./devlog/v1.0.0/021-portal-route-controller.md) - Portal Route Controller 경로 수정
- [020](./devlog/v1.0.0/020-portal-app-creation.md) - Portal App 생성 기능
- [019](./devlog/v1.0.0/019-portal-app-editor.md) - Portal App 에디터 구현

#### 에디터 코드 리팩토링
- [018](./devlog/v1.0.0/018-editor-refactoring.md) - AppEditorProvider 분리

#### Portal/Packages 개선
- [017](./devlog/v1.0.0/017-portal-info-editor.md) - Portal Info 에디터 구현
- [016](./devlog/v1.0.0/016-portal-category.md) - Portal 카테고리 개선

#### Route 앱 지원
- [015](./devlog/v1.0.0/015-route-ui-improvements.md) - Route 앱 UI 개선
- [014](./devlog/v1.0.0/014-namespace-sync.md) - Namespace 변경 시 폴더명/ID 자동 변경
- [013](./devlog/v1.0.0/013-route-info-editor.md) - Route Info 에디터 구현
- [012](./devlog/v1.0.0/012-route-support.md) - Route 앱 지원 추가

#### 버그 수정 및 개선
- [011](./devlog/v1.0.0/011-split-view-fix.md) - 창 분할 시 Wiz 탭 복원 버그 수정
- [010](./devlog/v1.0.0/010-refactoring.md) - 전체 코드 리팩토링
- [009](./devlog/v1.0.0/009-keyboard-shortcuts-fix.md) - Alt+1-6 단축키 버그 수정

#### 초기 개발 (기반 기능 구현)
- [008](./devlog/v1.0.0/008-keyboard-shortcuts.md) - Alt+1-6 단축키 구현
- [007](./devlog/v1.0.0/007-delete.md) - Delete 기능 구현
- [006](./devlog/v1.0.0/006-new-app.md) - New App 기능 구현
- [005](./devlog/v1.0.0/005-info-editor.md) - Info Editor 구현
- [004](./devlog/v1.0.0/004-app-editor-provider.md) - App Editor Provider 구현
- [003](./devlog/v1.0.0/003-file-system-provider.md) - File System Provider 구현
- [002](./devlog/v1.0.0/002-tree-view.md) - Tree View 구현
- [001](./devlog/v1.0.0/001-project-setup.md) - 프로젝트 초기 설정

---

## 현재 지원 기능

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
- `editors/portalAppEditor.js` - Portal App 에디터

### src/explorer/
- `fileExplorerProvider.js` - Flat App Types, 패키지 폴더 정렬, 가상 폴더 지원
- `models/categoryHandlers.js` - packages 라벨 변경, routeGroup 컨텍스트
- `appPatternProcessor.js` - 상수 사용
- `wizDragAndDropController.js` - 드래그 앤 드롭 컨트롤러

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
├── config (config/)
└── project (루트/)
    └── 기타 파일들 (config 제외)
```

---

## 향후 개선 사항

### 기본 기능 완성
- [ ] 패키지 생성 기능
- [x] Route 앱 생성 기능 (Source/Portal Route 지원)
- [x] Portal App 생성 기능
- [x] 드래그 앤 드롭 파일 이동
- [x] 다중 파일 선택
- [x] Portal 기본 폴더 자동 표시
- [ ] 검색 기능 (파일/앱 이름 빠른 검색)
- [ ] Git 상태 표시 (변경/추가/삭제 파일 아이콘)

### 빌드 & 개발 워크플로우
- [ ] Wiz CLI 명령어 연동
  - [ ] 빌드 실행 (`wiz build`)
  - [ ] 개발 서버 시작/중지 (`wiz run`)
  - [ ] 배포 명령 (`wiz deploy`)
  - [ ] 상태바에 빌드 상태 표시
  - [ ] 빌드 에러/경고 Problems 패널 연동
- [ ] Wiz API 서버 연동
  - [ ] 실시간 앱 목록 동기화
  - [ ] 서버 상태 모니터링
  - [ ] Hot Reload 지원

### MCP (Model Context Protocol) 기능
- [ ] VSCode WIZ MCP Server 구현
  - [ ] Wiz 프로젝트 구조 분석 제공
  - [ ] App/Route/Controller 정보 컨텍스트 제공
  - [ ] 코드 생성 지원 (템플릿 기반)
  - [ ] AI 기반 앱 구조 추천
- [ ] GitHub Copilot 연동
  - [ ] Wiz Framework 특화 코드 제안
  - [ ] app.json 스키마 자동완성

### 에디터 & 뷰어 기능
- [ ] 프리뷰 기능
  - [ ] 앱 실시간 미리보기 (iframe)
  - [ ] Route 경로 시뮬레이션
  - [ ] 모바일/태블릿 뷰포트 전환
- [ ] 코드 에디터 개선
  - [ ] Pug/HTML 구문 강조 개선
  - [ ] SCSS IntelliSense
  - [ ] Python Controller 자동완성
  - [ ] TypeScript/JavaScript 타입 정의

### 디버깅 & 테스팅
- [ ] 디버거 연동
  - [ ] Python Controller 디버깅
  - [ ] 브레이크포인트 지원
  - [ ] 변수 Inspector
- [ ] 테스트 러너
  - [ ] 단위 테스트 실행
  - [ ] E2E 테스트 지원
  - [ ] 테스트 커버리지 표시

### 협업 & 문서화
- [ ] 앱 문서 자동 생성
  - [ ] app.json 기반 문서화
  - [ ] API 엔드포인트 목록 추출
  - [ ] 의존성 그래프 시각화
- [ ] 팀 협업 기능
  - [ ] 앱 변경 이력 추적
  - [ ] 코드 리뷰 연동
  - [ ] 배포 승인 워크플로우

### 성능 & 최적화
- [ ] 대규모 프로젝트 지원
  - [ ] 가상 스크롤링 (수백개 앱 처리)
  - [ ] 지연 로딩 (Lazy Loading)
  - [ ] 캐싱 전략 개선
- [ ] 번들 크기 최적화 분석
- [ ] 의존성 중복 감지

### 확장성
- [ ] 플러그인 시스템
  - [ ] 커스텀 App 타입 등록
  - [ ] 에디터 확장 API
  - [ ] 테마/아이콘 커스터마이징
- [ ] 설정 관리
  - [ ] 프로젝트별 설정 프로파일
  - [ ] 팀 공유 설정 지원
