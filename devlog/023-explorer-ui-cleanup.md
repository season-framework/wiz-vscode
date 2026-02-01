# 023 - 탐색기 상단 UI 정리

## 개요
"WIZ EXPLORER" 타이틀 제거, 프로젝트명만 표시, 파일/폴더 추가 버튼 제거

## 변경 사항

### 1. 타이틀 변경 (`package.json`)
- viewsContainers title: "Wiz Explorer" → "Project"

### 2. 트리뷰 타이틀 (`src/extension.js`)
- `treeView.title`: "Project: main" → "main" (프로젝트명만 표시)

### 3. 상단 버튼 정리 (`package.json`)
- "새 파일", "새 폴더" 버튼 제거
- "새로고침", "프로젝트 전환" 버튼만 유지
