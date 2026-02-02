/**
 * Wiz Webview HTML Template Generator
 * 공통 HTML 템플릿 및 스타일 관리
 */

class WebviewTemplates {
    /**
     * 공통 CSS 스타일
     */
    static getCommonStyles() {
        return `
            body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                padding: 40px; 
                background-color: var(--vscode-editor-background); 
                color: var(--vscode-editor-foreground); 
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: var(--vscode-editorWidget-background);
                border: 1px solid var(--vscode-widget-border);
                border-radius: 6px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            h2 { margin-top: 0; margin-bottom: 20px; font-weight: 600; font-size: 18px; }
            .form-group { margin-bottom: 15px; display: flex; align-items: center; }
            .form-group label { width: 140px; font-weight: 500; font-size: 13px; opacity: 0.9; }
            .form-group input, .form-group select { 
                flex: 1; 
                padding: 6px 10px; 
                border: 1px solid var(--vscode-input-border); 
                background: var(--vscode-input-background); 
                color: var(--vscode-input-foreground); 
                border-radius: 4px;
                outline: none;
            }
            .form-group input:focus, .form-group select:focus { 
                border-color: var(--vscode-focusBorder); 
            }
            .btn-group { margin-top: 30px; display: flex; flex-direction: column; gap: 10px; }
            button { 
                padding: 8px 16px; 
                cursor: pointer; 
                border-radius: 20px; 
                font-weight: 500; 
                font-size: 13px; 
                border: 1px solid var(--vscode-button-border, transparent);
                transition: background 0.2s;
            }
            .btn-primary { 
                background: var(--vscode-button-background); 
                color: var(--vscode-button-foreground); 
                border: none;
            }
            .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
            .btn-secondary { 
                background: transparent; 
                color: #4daafc; 
                border-color: #4daafc; 
            }
            .btn-secondary:hover { background: rgba(77, 170, 252, 0.1); }
            .btn-danger {
                background: transparent;
                color: #fc4d4d;
                border-color: #fc4d4d;
            }
            .btn-danger:hover { background: rgba(252, 77, 77, 0.1); }
        `;
    }

    /**
     * 공통 키보드 단축키 스크립트
     * @param {string} saveFunction - 저장 함수명
     */
    static getKeyboardShortcutScript(saveFunction = 'save') {
        return `
            window.addEventListener('keydown', function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    ${saveFunction}();
                }
            });
        `;
    }

    /**
     * Select 옵션 HTML 생성
     * @param {string[]} items - 옵션 목록
     * @param {string} selected - 선택된 값
     * @param {boolean} includeNone - None 옵션 포함 여부
     */
    static generateSelectOptions(items, selected = '', includeNone = true) {
        let html = includeNone ? '<option value="">None</option>' : '';
        html += items.map(item => 
            `<option value="${item}" ${item === selected ? 'selected' : ''}>${item}</option>`
        ).join('');
        return html;
    }

    /**
     * 폼 그룹 HTML 생성 (input)
     */
    static formGroupInput(id, label, value = '', placeholder = '', options = {}) {
        const { type = 'text', hidden = false, autofocus = false } = options;
        if (hidden) {
            return `<input type="hidden" id="${id}" value="${value}" />`;
        }
        return `
            <div class="form-group">
                <label>${label}</label>
                <input type="${type}" id="${id}" value="${value}" placeholder="${placeholder}" ${autofocus ? 'autofocus' : ''} />
            </div>
        `;
    }

    /**
     * 폼 그룹 HTML 생성 (select)
     */
    static formGroupSelect(id, label, items, selected = '', options = {}) {
        const { hidden = false, includeNone = true } = options;
        if (hidden) {
            return `<input type="hidden" id="${id}" value="${selected}" />`;
        }
        return `
            <div class="form-group">
                <label>${label}</label>
                <select id="${id}">
                    ${this.generateSelectOptions(items, selected, includeNone)}
                </select>
            </div>
        `;
    }

    /**
     * App Info/Create 폼 필드 데이터 수집 스크립트
     */
    static getFormDataCollectionScript() {
        return `
            function collectFormData() {
                const viewTypeEl = document.getElementById('viewType');
                return {
                    title: document.getElementById('title').value,
                    namespace: document.getElementById('namespace').value,
                    category: document.getElementById('category').value,
                    ngRouting: document.getElementById('ngRouting').value,
                    previewUrl: document.getElementById('previewUrl').value,
                    controller: document.getElementById('controller').value,
                    layout: document.getElementById('layout').value,
                    viewType: viewTypeEl ? viewTypeEl.value : null
                };
            }
        `;
    }

    /**
     * 기본 HTML 문서 래퍼
     */
    static wrapHtml(bodyContent, scriptContent = '') {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${this.getCommonStyles()}</style>
        </head>
        <body>
            ${bodyContent}
            <script>
                const vscode = acquireVsCodeApi();
                ${this.getFormDataCollectionScript()}
                ${this.getKeyboardShortcutScript('save')}
                ${scriptContent}
            </script>
        </body>
        </html>
        `;
    }
}

module.exports = WebviewTemplates;
