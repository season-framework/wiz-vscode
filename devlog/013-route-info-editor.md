# 013 - Route Info 에디터 구현

## 개요
Route 전용 정보 편집 UI 생성

## 구현 내용

`src/editor/appEditorProvider.js`:

```javascript
generateRouteInfoHtml(data, controllers, appPath) {
    // Title, ID, Route, Category, Preview URL, Controller 필드
}
```

## 지원 필드

- Title
- ID
- Route
- Category
- Preview URL (viewuri)
- Controller (Select)
