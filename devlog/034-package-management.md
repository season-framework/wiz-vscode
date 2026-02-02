# 034 - 패키지 관리 및 UI 개선

## 개요
패키지 생성/내보내기, 빌드 트리거, App/Route 생성 다이얼로그 방식 변경, 기타 UI 개선

## 구현 내역

### 1. 패키지 생성 기능
- `wizExplorer.newPackage` 명령어 추가
- packages(portal) 카테고리에서 우클릭 → "New Package" 메뉴
- 순차적 다이얼로그로 namespace, title 입력
- `wiz project package create` CLI 명령 실행

### 2. 패키지 내보내기 (Export)
- `wizExplorer.exportPackage` 명령어 추가
- 개별 패키지 우클릭 → "Export Package" 메뉴
- `archiver`를 사용해 `.wizpkg` (zip) 파일 생성
- wiz root의 `exports` 폴더에 저장

### 3. Exports 카테고리 추가
- 트리뷰에 `exports` 그룹 추가 (source, packages, project 외)
- wiz root의 `exports` 폴더 내용 표시
- `FileExplorerProvider`에 `wizRoot` 속성 추가

### 4. 빌드 트리거 개선
- 파일 저장 시 `wiz project build` 자동 실행
- Output Channel로 빌드 로그 출력 (ANSI 코드 제거)
- Webview 에디터 저장 시에도 빌드 트리거 동작

### 5. 빌드 버튼 추가
- 탐색기 상단에 빌드 버튼 (tools 아이콘) 추가
- Normal Build / Clean Build 선택 다이얼로그
- `--clean` 옵션으로 Clean Build 지원

### 6. App/Route 생성 방식 변경
- Webview 에디터 대신 순차적 다이얼로그 방식으로 변경
- Standard App: Namespace → Title → Category → Controller → (Page: Layout, ViewURI)
- Portal App: Namespace → Title → Category → Controller
- Route: ID → Title → Route Path
- 기본 템플릿 파일 자동 생성 (view.pug, view.ts)

### 7. 기본 템플릿 추가
`src/core/constants.js`에 `APP_TEMPLATES` 추가:
```javascript
const APP_TEMPLATES = {
    'view.pug': `div Hello, World!`,
    'view.ts': `import { OnInit, Input } from '@angular/core';

export class Component implements OnInit {
    @Input() title: any;

    public async ngOnInit() {
    }
}`,
    'view.scss': ''
};
```

### 8. 파일 다운로드 기능
- `wizExplorer.downloadFile` 명령어 추가
- 파일/폴더 우클릭 → "다운로드..." 메뉴
- 기본 탐색기에서 reveal 후 안내 메시지 표시

### 9. Template 복사 기능
- `wizExplorer.copyTemplate` 명령어 추가
- App 우클릭 → "Template 복사" 메뉴
- app.json의 template 값을 클립보드에 복사

### 10. UI 정리
- "Reveal in File Explorer" 컨텍스트 메뉴 제거
- 사용하지 않는 Create Editor 파일 삭제:
  - `createEditor.js`
  - `createPortalAppEditor.js`
  - `createRouteAppEditor.js`

## 수정된 파일
- `src/extension.js` - 주요 로직 추가
- `src/core/constants.js` - APP_TEMPLATES 추가
- `src/core/index.js` - APP_TEMPLATES export
- `src/editor/appEditorProvider.js` - Create Editor import 제거
- `src/explorer/fileExplorerProvider.js` - wizRoot, ExportsCategory 추가
- `src/explorer/models/categoryHandlers.js` - ExportsCategory 클래스 추가
- `package.json` - 명령어 및 메뉴 등록
