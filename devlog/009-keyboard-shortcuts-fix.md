# 009 - Alt+1-6 단축키 버그 수정

## 개요
탭 전환 대신 숫자가 입력되는 문제 해결

## 문제
Alt+1-6 단축키가 탭 전환 대신 숫자를 입력하는 문제

## 해결
- `package.json` keybindings의 `when` 조건에 `resourceScheme == 'wiz'` 추가
- `extension.js`의 `switchFile()` 함수 단순화 - 텍스트 에디터와 웹뷰 모두에서 경로를 올바르게 해석하도록 수정

## 변경 파일
- `package.json` - keybindings when 조건 수정
- `src/extension.js` - switchFile(), resolveCurrentAppPath() 함수 개선
