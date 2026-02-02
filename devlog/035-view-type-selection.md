# 035 - View Type 선택 기능

## 개요
App Editor에서 View 파일 타입(pug/html) 선택 기능 추가 및 기본 타입 HTML로 변경

## 구현 내역

### 1. 기본 View Type 변경
- `view.pug` → `view.html`로 기본 템플릿 변경
- `APP_TEMPLATES`에서 `view.html` 사용

**src/core/constants.js:**
```javascript
const APP_TEMPLATES = {
    'view.html': `<div>Hello, World!</div>`,
    'view.ts': `import { OnInit, Input } from '@angular/core';
...
    'view.scss': ''
};
```

### 2. Portal App Editor에 View Type 선택 추가

**src/editor/editors/portalAppEditor.js:**

- `loadFormOptions()`: 현재 view 타입 감지 (view.pug/view.html 존재 여부)
- `generateHtml()`: View Type 선택 드롭다운 추가
- `collectFormData()`: viewType 필드 추가
- `handleUpdate()`: viewType 변경 시 `handleViewTypeChange()` 호출
- `handleViewTypeChange()`: pug ↔ html 변환 처리
  - 기존 파일 내용을 주석으로 보존
  - 새 타입의 기본 템플릿 생성
  - 기존 파일 삭제

### 3. 변환 로직

**pug → html:**
```javascript
const htmlContent = `<!-- Converted from Pug -->\n<div>Hello, World!</div>\n<!-- Original Pug:\n${pugContent}\n-->`;
fs.writeFileSync(htmlPath, htmlContent, 'utf8');
fs.unlinkSync(pugPath);
```

**html → pug:**
```javascript
const pugContent = `//- Converted from HTML\ndiv Hello, World!\n//- Original HTML:\n//- ${htmlContent}`;
fs.writeFileSync(pugPath, pugContent, 'utf8');
fs.unlinkSync(htmlPath);
```

## 수정된 파일
- `src/core/constants.js` - APP_TEMPLATES 기본 타입 html로 변경
- `src/extension.js` - App 생성 시 view.html 사용
- `src/editor/editors/portalAppEditor.js` - View Type 선택 UI 및 변환 로직 추가
