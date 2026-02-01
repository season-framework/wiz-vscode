# 027 - 다중 선택 기능 추가

## 개요
트리뷰에서 여러 파일/폴더 동시 선택 가능

## 구현

`src/extension.js`:

```javascript
const treeView = vscode.window.createTreeView('wizExplorer', {
    treeDataProvider: fileExplorerProvider,
    showCollapseAll: true,
    canSelectMany: true,
    dragAndDropController: dragAndDropController
});
```
