# Wiz VSCode Explorer

VSCode 파일 탐색기 형태의 확장 프로그램 프로토타입입니다.

## 기능

- 📁 워크스페이스 파일 및 폴더 트리 뷰
- 🔄 새로고침 기능
- 📄 파일 클릭으로 열기
- 🔍 파일 탐색기에서 보기

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. VSCode에서 F5를 눌러 디버그 모드로 실행

## 구조

```
wiz-vscode/
├── package.json              # 확장 프로그램 메타데이터
├── src/
│   ├── extension.js         # 확장 프로그램 진입점
│   └── fileExplorerProvider.js  # 파일 탐색기 트리 프로바이더
└── README.md
```

## 주요 컴포넌트

### FileExplorerProvider
- 트리 뷰 데이터 제공
- 파일 시스템 읽기
- 트리 아이템 생성 및 정렬

### 지원 명령어
- `wizExplorer.refresh`: 트리 뷰 새로고침
- `wizExplorer.openFile`: 파일 열기
- `wizExplorer.revealInExplorer`: 파일 탐색기에서 보기

## 개발 예정 기능

- [ ] 파일 검색
- [ ] 파일 필터링
- [ ] 파일 생성/삭제/이름 변경
- [ ] 드래그 앤 드롭
- [ ] 북마크 기능
