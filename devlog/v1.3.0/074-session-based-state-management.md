# 074. 세션 기반 MCP 상태 관리 (v1.3.0)

## 개요
여러 VS Code 인스턴스가 동시에 작업할 때 `.vscode/.wiz-state.json` 상태가 충돌하지 않도록 세션 단위 관리 구조로 전환하고, 일주일 이상 미사용 세션을 자동 정리하는 기능을 추가했습니다.

## 변경 사항

### 1. Extension 측 세션 기반 상태 관리
- `src/services/project/mcpManager.js`
  - `vscode.env.sessionId`를 세션 키로 사용하여 VS Code 인스턴스별 상태 분리
  - `SESSION_EXPIRY_MS` 상수 추가 (7일, ms)
  - `_getStatePath()`: 상태 파일 경로 반환 헬퍼
  - `_readStateFile()`: 세션 맵 구조 읽기 (구버전 단일 포맷 → `_migrated` 세션으로 자동 마이그레이션)
  - `_writeStateFile()`: 세션 맵 구조 쓰기
  - `writeState()`: 현재 세션만 upsert, `lastUsed` 타임스탬프 기록
  - `cleanupSessions()`: 7일 초과 세션 자동 정리 (생성자에서 호출)
  - `removeSession()`: 현재 세션 항목 제거
  - `dispose()`: 종료 시 `removeSession()` 호출

### 2. MCP 서버 측 세션 기반 로드/저장
- `src/mcp/index.js`
  - `_loadState()`: 세션 맵에서 `lastUsed`가 가장 최근인 세션 선택, 구버전 단일 포맷 호환 유지
  - `_saveState()`: 기존 세션 데이터 보존하면서 가장 최근 세션만 업데이트

### 3. 상태 파일 포맷 변경
- 기존: `{ workspacePath, currentProject }`
- 변경: `{ sessions: { [sessionId]: { workspacePath, currentProject, lastUsed } } }`
