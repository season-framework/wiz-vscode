# 065. MCP 서버 도구 대규모 확장 (v1.2.1)

## 개요
AI 에이전트(Copilot)가 Wiz 프로젝트를 직접 탐색·생성·수정·빌드할 수 있도록 MCP 서버의 도구를 16개에서 29개로 확장하고, 도구 설명을 에이전트 친화적으로 대폭 개선했다.

## 변경 사항

### 1. 신규 도구 추가 (13개)
- `src/mcp/index.js` 전면 재작성 (v1.0.0 → v2.0.0)

#### 프로젝트 이해
- **wiz_get_project_info**: 프로젝트 종합 정보 (앱 수, 패키지 목록, 경로, src 구조) — 에이전트가 최초 호출할 도구
- **wiz_get_project_structure**: 디렉토리 트리 (depth, subPath 조절 가능)
- **wiz_search_apps**: 키워드로 앱 검색 (이름/제목/네임스페이스/카테고리 매칭)

#### 포탈 앱/라우트 생성
- **wiz_create_portal_app**: 포탈 패키지 내 앱 생성 (view.html/ts/scss + app.json + template 자동 생성)
- **wiz_create_portal_route**: 포탈 패키지 내 라우트 생성 (controller.py + app.json)

#### 범용 파일 시스템 조작
- **wiz_list_directory**: 임의 디렉토리 내용 조회 (이름, 타입, 크기, 수정일)
- **wiz_read_file**: 임의 파일 읽기 (줄 범위 지정 가능)
- **wiz_write_file**: 임의 파일 생성/덮어쓰기 (부모 폴더 자동 생성)
- **wiz_create_folder**: 폴더 생성
- **wiz_delete_file**: 파일/폴더 삭제
- **wiz_rename_file**: 파일/폴더 이름변경 또는 이동

#### 개발 헬퍼
- **wiz_list_controllers**: Python 컨트롤러 목록 (표준/포탈 패키지 선택)
- **wiz_list_layouts**: 레이아웃 앱 목록 (page 생성 시 참조)

### 2. 기존 도구 개선
- **wiz_create_app**: `controller`, `layout`, `viewuri` 파라미터 추가, APP_TEMPLATES 적용
- **wiz_get_app_info**: 파일별 크기/디렉토리 여부 정보 포함
- **wiz_list_packages**: 하위 폴더 목록(subFolders) 포함
- **wiz_list_apps**: src/app/, src/{type}/, portal 전체 스캔 및 중복 제거
- 모든 도구의 description을 에이전트 친화적으로 상세화 (파일 구조 설명, 경로 패턴 등)

### 3. 코드 구조 개선
- 도구 정의(`_getToolDefinitions`)와 핸들러 매핑(`_getToolHandler`)을 분리하여 유지보수성 향상
- `_jsonResult`, `_getSrcPath`, `_getAppParentPath`, `_buildTree`, `_scanApps` 헬퍼 메서드 추가
- JSON 결과를 pretty-print(indent 2)로 통일
