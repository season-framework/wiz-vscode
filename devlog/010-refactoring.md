# 010 - 전체 코드 리팩토링

## 개요
Core 모듈 생성, 디자인 패턴 적용, 중복 코드 제거

## 목표
중복 코드 제거, 객체 지향적 디자인 패턴 적용, 재사용 가능한 컴포넌트 분리

## 새로 생성된 Core 모듈 (`/src/core/`)

| 파일 | 목적 |
|------|------|
| `constants.js` | `APP_TYPES`, `FILE_TYPE_MAPPING`, `FOLDER_ICONS` 등 중앙화 상수 |
| `pathUtils.js` | URI 경로 파싱, 앱 폴더 해석, 컨트롤러/레이아웃 로딩 |
| `fileUtils.js` | 파일 읽기/쓰기, 언어 감지, JSON 처리 |
| `uriFactory.js` | Wiz URI 생성 팩토리 |
| `webviewTemplates.js` | HTML 템플릿 및 스타일 생성 |
| `index.js` | 모듈 통합 export |

## 적용된 디자인 패턴

1. **Configuration Object Pattern** - 상수 중앙화
2. **Utility/Helper Pattern** - 경로/파일 유틸리티
3. **Factory Pattern** - URI 생성
4. **Template Method Pattern** - HTML 템플릿
5. **Command Pattern** - 커맨드 등록 배열

## 리팩토링된 파일

- `src/editor/wizFileSystemProvider.js` - WizPathUtils.getRealPathFromUri 사용
- `src/editor/appContextListener.js` - 중복 경로 파싱 로직 제거
- `src/editor/appEditorProvider.js` - WebviewTemplates 활용, 모듈화
- `src/explorer/appPatternProcessor.js` - APP_TYPES 상수 사용
- `src/explorer/treeItems/fileTreeItem.js` - FOLDER_ICONS 상수 사용
- `src/explorer/treeItems/appGroupItem.js` - createAppItem() 헬퍼 메소드 추가
- `src/extension.js` - 커맨드 배열 패턴, resolveCurrentAppPath() 헬퍼
