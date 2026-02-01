# 024 - Source app/route 그룹 제거

## 개요
Source 카테고리에서 존재하지 않는 route 그룹 제거

## 문제
Source 카테고리에 존재하지 않는 `app/route` 그룹이 표시되는 문제

## 해결

`src/explorer/appPatternProcessor.js`:
- `TYPES` getter에서 `FLAT_APP_TYPES` 필터링
- Route는 플랫 구조이므로 app 하위 그룹으로 표시하지 않음

```javascript
static get TYPES() {
    return APP_TYPES.filter(type => !FLAT_APP_TYPES.includes(type));
}
```
