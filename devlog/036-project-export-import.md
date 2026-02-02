# 036 - 프로젝트 내보내기/가져오기 기능

## 날짜
2026-02-02

## 개요
프로젝트 선택기 메뉴에 프로젝트 내보내기 및 `.wizproject` 파일 가져오기 기능을 추가했습니다.

## 변경 사항

### 1. 프로젝트 내보내기 기능
- **메뉴 항목**: `$(package) 프로젝트 내보내기`
- **동작**: 
  1. 내보낼 프로젝트 선택
  2. `wiz project export --project=<name> --output=<path>` 명령 실행
  3. `exports` 폴더에 프로젝트명으로 저장 (확장자 없음)
- **출력 경로**: `{wizRoot}/exports/{프로젝트명}`

### 2. 프로젝트 파일 가져오기 기능
- **메뉴 항목**: `$(file-zip) 프로젝트 파일 불러오기 (.wizproject)`
- **동작**:
  1. `.wizproject` 파일 선택 (파일 다이얼로그)
  2. 새 프로젝트 이름(Namespace) 입력 (기본값: 파일명)
  3. `project/<namespace>` 폴더 생성
  4. `unzip -o "<파일>" -d "<대상경로>"` 명령으로 압축 해제
  5. 성공 시 프로젝트 전환 여부 확인
- **에러 처리**: 실패 시 생성된 폴더 자동 정리

### 3. 프로젝트 선택기 메뉴 구성
```
- 프로젝트 불러오기 (Git)      → Git 저장소 복제
- 프로젝트 파일 불러오기        → .wizproject 파일 가져오기
- 프로젝트 내보내기            → exports 폴더로 내보내기
- 프로젝트 삭제하기            → 로컬 프로젝트 폴더 삭제
──────────────────────────
- [프로젝트 목록]
```

## 수정된 파일
- `src/extension.js`: 프로젝트 선택기 메뉴 항목 및 액션 로직 추가

## 기술 세부사항

### 내보내기 명령
```javascript
const command = `wiz project export --project=${projectToExport} --output="${outputPath}"`;
await exec(command, { cwd: fileExplorerProvider.wizRoot });
```

### 가져오기 (압축 해제)
```javascript
// unzip 명령어 사용 (wiz project import 명령어 없음)
const command = `unzip -o "${filePath}" -d "${targetPath}"`;
await exec(command);
```

### withProgress 패턴
```javascript
try {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `프로젝트 '${projectName}' 가져오는 중...`,
        cancellable: false
    }, async () => {
        // 비동기 작업
        await exec(command);
    });
    // 성공 처리
} catch (err) {
    // 에러 처리 및 폴더 정리
}
```

## 주의사항
- `withProgress`에 `await`를 사용해야 프로그레스 알림이 작업 완료 후 정상적으로 사라짐
- `try-catch`는 `withProgress` 외부에 위치해야 에러 핸들링이 올바르게 동작
- 성공 메시지 다이얼로그는 `withProgress` 외부에서 표시해야 프로그레스가 먼저 사라짐
