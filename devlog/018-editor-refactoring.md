# 018 - AppEditorProvider 분리

## 개요
기능별 에디터 클래스 분리 및 모듈화

## 목표
기능별로 뒤섞여 있던 AppEditorProvider 코드를 기능 단위로 분리하여 유지보수성 향상

## 새로 생성된 에디터 모듈 (`/src/editor/editors/`)

| 파일 | 역할 |
|------|------|
| `editorBase.js` | 모든 에디터의 공통 기본 클래스 (패널 생성/종료/메시지 처리) |
| `appEditor.js` | 일반 App (Page, Widget 등) 정보 수정 에디터 |
| `routeEditor.js` | Route 앱 전용 정보 수정 에디터 (AppEditor 상속) |
| `portalEditor.js` | Portal Package (portal.json) 정보 수정 에디터 |
| `portalAppEditor.js` | Portal App 전용 정보 수정 에디터 (AppEditor 상속) |
| `createEditor.js` | 새 App 생성 에디터 |
| `createPortalAppEditor.js` | Portal App 생성 에디터 |

## 적용된 디자인 패턴

1. **상속 패턴** - EditorBase → AppEditor → RouteEditor
2. **Facade 패턴** - AppEditorProvider가 각 에디터 인스턴스 관리
3. **Template Method 패턴** - 공통 로직(패널 생성)은 부모에서, 세부 로직(HTML 생성)은 자식에서 처리

## 리팩토링 결과

- 기존 500줄+ 코드에서 130줄로 대폭 축소
- HTML 생성, 메시지 핸들링 로직을 각 에디터 클래스로 위임
- `activeEditor` 프로퍼티로 현재 활성 에디터 인스턴스 추적

## 디렉토리 구조

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
