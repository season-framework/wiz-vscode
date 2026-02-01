# 028 - Portal 기본 폴더 자동 표시

## 개요
Portal 패키지에서 기본 구조 폴더들이 없어도 항상 표시

## 요구사항
Portal 패키지에서 기본 구조 폴더들이 없어도 항상 표시

## 구현

`src/explorer/fileExplorerProvider.js`:

### 1. 기본 폴더 목록
- `info`, `app`, `route`, `controller`, `model`, `assets`, `libs`, `styles`

### 2. 가상 아이템 추가
- 실제로 존재하지 않는 폴더/파일은 `(create)` description과 함께 표시
- `portal.json`이 없으면 가상 `info` 아이템 추가

### 3. 자동 생성
- 가상 폴더를 확장(클릭)하면 실제 폴더가 자동으로 생성됨
