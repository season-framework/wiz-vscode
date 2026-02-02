/**
 * Wiz App Core Constants
 * 중앙화된 상수 및 설정 관리
 */

// App 타입 정의
const APP_TYPES = ['page', 'component', 'layout', 'route'];

// App 타입 중 플랫 구조 (접두어 없음)
const FLAT_APP_TYPES = ['route'];

// 파일 타입별 매핑 정의
const FILE_TYPE_MAPPING = {
    info: {
        fileName: 'app.json',
        label: 'INFO',
        icon: '$(json)',
        language: 'json'
    },
    controller: {
        fileName: 'controller.py',
        label: 'CONTROLLER',
        icon: '$(symbol-method)',
        language: 'python'
    },
    ui: {
        fileName: ['view.pug', 'view.html'],
        label: 'UI',
        icon: '$(layout)',
        language: { '.pug': 'jade', '.html': 'html' }
    },
    component: {
        fileName: 'view.ts',
        label: 'COMPONENT',
        icon: '$(code)',
        language: 'typescript'
    },
    scss: {
        fileName: 'view.scss',
        label: 'SCSS',
        icon: '$(symbol-color)',
        language: 'scss'
    },
    api: {
        fileName: 'api.py',
        label: 'API',
        icon: '$(server)',
        language: 'python'
    },
    socket: {
        fileName: 'socket.py',
        label: 'SOCKET',
        icon: '$(plug)',
        language: 'python'
    }
};

// App 폴더 식별자 파일들
const APP_INDICATOR_FILES = ['app.json', 'view.pug', 'view.html', 'view.ts', 'api.py', 'controller.py'];

// 폴더 아이콘 매핑
const FOLDER_ICONS = {
    angular: 'symbol-class',
    app: 'symbol-class',
    assets: 'folder-library',
    controller: 'symbol-method',
    libs: 'library',
    model: 'symbol-method',
    route: 'circuit-board',
    styles: 'symbol-color'
};

// 언어 확장자 매핑
const EXTENSION_LANGUAGE_MAP = {
    '.pug': 'jade',
    '.html': 'html',
    '.ts': 'typescript',
    '.scss': 'scss',
    '.py': 'python',
    '.json': 'json'
};

// App 기본 템플릿
const APP_TEMPLATES = {
    'view.html': `<div>Hello, World!</div>`,
    'view.ts': `import { OnInit, Input } from '@angular/core';

export class Component implements OnInit {
    @Input() title: any;

    public async ngOnInit() {
    }
}`,
    'view.scss': ''
};

module.exports = {
    APP_TYPES,
    FLAT_APP_TYPES,
    FILE_TYPE_MAPPING,
    APP_INDICATOR_FILES,
    FOLDER_ICONS,
    EXTENSION_LANGUAGE_MAP,
    APP_TEMPLATES
};
