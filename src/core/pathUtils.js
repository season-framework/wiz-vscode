/**
 * Wiz Path Utilities
 * 경로 관련 공통 유틸리티 함수들
 */

const path = require('path');
const fs = require('fs');
const { APP_TYPES, APP_INDICATOR_FILES } = require('./constants');

class WizPathUtils {
    /**
     * Wiz URI에서 실제 파일 경로 추출
     * @param {vscode.Uri} uri - Wiz URI
     * @returns {string|null} 실제 파일 경로
     */
    static getRealPathFromUri(uri) {
        // Strategy 1: Query parameter에서 추출 (권장)
        if (uri.query) {
            const query = new URLSearchParams(uri.query);
            const pathParam = query.get('path');
            if (pathParam) {
                try {
                    // pathParam would be automatically decoded by URLSearchParams, but 
                    // since we double-encoded (URI string + encodeURIComponent), it should be fine.
                    // If we used encodeURIComponent, URLSearchParams decodes it back to "base64".
                    // Then Buffer decodes base64.
                    return Buffer.from(pathParam, 'base64').toString('utf8');
                } catch (e) {
                    console.error('Failed to decode path from query:', e);
                }
            }
        }

        // Strategy 2: Legacy path format /<base64>/<name>
        const parts = uri.path.split('/');
        if (parts.length >= 2) {
            const base64Path = parts[1];
            try {
                const decoded = Buffer.from(base64Path, 'base64').toString('utf8');
                if (decoded.includes('/') || decoded.includes('\\')) {
                    return decoded;
                }
            } catch (e) { }
        }

        return null;
    }

    /**
     * 경로를 base64로 인코딩
     * @param {string} filePath - 파일 경로
     * @returns {string} Base64 인코딩된 문자열
     */
    static encodePathToBase64(filePath) {
        return Buffer.from(filePath).toString('base64');
    }

    /**
     * App 폴더명에서 정보 추출
     * @param {string} folderPath - 폴더 경로
     * @returns {{ category: string, appTitle: string, isWizApp: boolean }}
     */
    static parseAppFolder(folderPath) {
        const folderName = path.basename(folderPath);
        const parentPath = path.dirname(folderPath);
        const parentName = path.basename(parentPath);
        const parts = folderName.split('.');

        let category = 'app';
        let appTitle = folderName;

        if (parts.length > 1 && APP_TYPES.includes(parts[0])) {
            category = parts[0];
            appTitle = parts.slice(1).join('.');
        } else if (parentName === 'route') {
            category = 'route';
            appTitle = folderName;
        } else if (parts[0] === 'route') { // support route.brand format too if exists
             category = 'route';
             appTitle = parts.slice(1).join('.');
        }

        const isWizApp = APP_TYPES.includes(category);
        return { category, appTitle, isWizApp };
    }

    /**
     * 해당 폴더가 Wiz App 폴더인지 확인
     * @param {string} dirPath - 디렉토리 경로
     * @returns {boolean}
     */
    static isAppFolder(dirPath) {
        if (!dirPath || !fs.existsSync(dirPath)) return false;
        return APP_INDICATOR_FILES.some(f => fs.existsSync(path.join(dirPath, f)));
    }

    /**
     * 경로에서 프로젝트 루트의 controller 디렉토리 찾기
     * @param {string} startPath - 시작 경로
     * @param {vscode.WorkspaceFolder} workspaceFolder - VS Code 워크스페이스 폴더
     * @returns {string|null}
     */
    static findControllerDir(startPath, workspaceFolder) {
        let currentDir = startPath;
        
        // Walk up to find src/controller
        while (currentDir && path.dirname(currentDir) !== currentDir) {
            const testPath = path.join(currentDir, 'src', 'controller');
            if (fs.existsSync(testPath)) {
                return testPath;
            }
            currentDir = path.dirname(currentDir);
        }

        // Fallback: workspace folder
        if (workspaceFolder) {
            const wsPath = path.join(workspaceFolder.uri.fsPath, 'src', 'controller');
            if (fs.existsSync(wsPath)) {
                return wsPath;
            }
        }

        return null;
    }

    /**
     * Controller 목록 로드
     * @param {string} controllerDir - Controller 디렉토리 경로
     * @returns {string[]}
     */
    static loadControllers(controllerDir) {
        if (!controllerDir || !fs.existsSync(controllerDir)) return [];
        
        try {
            return fs.readdirSync(controllerDir)
                .filter(file => file.endsWith('.py') && file !== '__init__.py')
                .map(file => file.replace('.py', ''));
        } catch (e) {
            return [];
        }
    }

    /**
     * 해당 디렉토리에서 layout 목록 로드
     * @param {string} parentDir - 부모 디렉토리
     * @returns {string[]}
     */
    static loadLayouts(parentDir) {
        if (!parentDir || !fs.existsSync(parentDir)) return [];
        
        try {
            return fs.readdirSync(parentDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('layout.'))
                .map(dirent => dirent.name);
        } catch (e) {
            return [];
        }
    }
}

module.exports = WizPathUtils;
