# 022 - Portal 패키지 폴더 아이콘 통일

## 개요
app, route, controller, model, assets, libs, styles 폴더에 일관된 아이콘 적용

## 요구사항
Portal 패키지 내 특수 폴더들에 Source 디렉토리와 동일한 아이콘 적용

## 구현

`src/explorer/fileExplorerProvider.js`, `src/core/constants.js`:

| 폴더 | 아이콘 |
|------|--------|
| app | `layers` |
| route | `circuit-board` |
| controller | `symbol-method` |
| model | `symbol-method` |
| assets | `folder-library` |
| libs | `library` |
| styles | `symbol-color` |
