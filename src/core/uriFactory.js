/**
 * Wiz URI Factory
 * Wiz 가상 파일 시스템 URI 생성 유틸리티
 */

const vscode = require('vscode');
const path = require('path');
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
        const label = `${appTitle} [${typeLabel}]`;
        const safeLabel = label.replace(/[\\/]/g, ' ');
        const uriPath = `/${safeLabel}`;
        
        return vscode.Uri.from({
            scheme: 'wiz',
            authority: category,
            path: uriPath,
            query: `path=${encodeURIComponent(encodedPath)}&label=${encodeURIComponent(label)}`
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
        let { category, appTitle } = WizPathUtils.parseAppFolder(appPath);
        
        // Portal App인 경우 category(portal-app) 대신 패키지명 표시
        if (category === 'portal-app') {
            const parentDir = path.dirname(appPath); // app
            const packagePath = path.dirname(parentDir); // package
            category = path.basename(packagePath);
        }

        return this.create(filePath, category, appTitle, typeLabel);
    }
}

module.exports = WizUriFactory;
