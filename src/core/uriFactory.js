/**
 * Wiz URI Factory
 * Wiz 가상 파일 시스템 URI 생성 유틸리티
 */

const vscode = require('vscode');
const WizPathUtils = require('./pathUtils');

class WizUriFactory {
    /**
     * Wiz 가상 파일 URI 생성
     * @param {string} realPath - 실제 파일 경로
     * @param {string} category - 카테고리 (page, component, layout)
     * @param {string} appTitle - App 타이틀
     * @param {string} typeLabel - 타입 라벨 (UI, API 등)
     * @returns {vscode.Uri}
     */
    static create(realPath, category, appTitle, typeLabel) {
        const encodedPath = WizPathUtils.encodePathToBase64(realPath);
        const virtualName = `${appTitle} [${typeLabel}]`;
        
        return vscode.Uri.from({
            scheme: 'wiz',
            path: `/${category}/${appTitle}/${virtualName}`,
            query: `path=${encodeURIComponent(encodedPath)}`
        });
    }

    /**
     * App 폴더 경로와 타입으로 URI 생성
     * @param {string} appPath - App 폴더 경로
     * @param {string} filePath - 실제 파일 경로
     * @param {string} typeLabel - 타입 라벨
     * @returns {vscode.Uri}
     */
    static fromAppPath(appPath, filePath, typeLabel) {
        const { category, appTitle } = WizPathUtils.parseAppFolder(appPath);
        return this.create(filePath, category, appTitle, typeLabel);
    }
}

module.exports = WizUriFactory;
