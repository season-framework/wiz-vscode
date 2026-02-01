/**
 * Wiz File Utilities
 * 파일 관련 공통 유틸리티 함수들
 */

const path = require('path');
const fs = require('fs');
const { FILE_TYPE_MAPPING, EXTENSION_LANGUAGE_MAP } = require('./constants');

class WizFileUtils {
    /**
     * App 폴더 내 파일 정보 읽기
     * @param {string} appPath - App 폴더 경로
     * @returns {Object} 파일 타입별 정보
     */
    static readAppFiles(appPath) {
        const result = {};
        
        for (const [type, config] of Object.entries(FILE_TYPE_MAPPING)) {
            const fileNames = Array.isArray(config.fileName) ? config.fileName : [config.fileName];
            
            // 존재하는 파일 찾기
            let fileName = fileNames.find(f => fs.existsSync(path.join(appPath, f)));
            if (!fileName) fileName = fileNames[0]; // 기본값
            
            const fullPath = path.join(appPath, fileName);
            result[type] = {
                type,
                fileName,
                fullPath,
                exists: fs.existsSync(fullPath),
                label: config.label,
                icon: config.icon
            };
        }
        
        return result;
    }

    /**
     * 파일 확장자로부터 언어 ID 반환
     * @param {string} filePath - 파일 경로
     * @returns {string|null} 언어 ID
     */
    static getLanguageFromExtension(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return EXTENSION_LANGUAGE_MAP[ext] || null;
    }

    /**
     * 파일명에서 타입 추론
     * @param {string} fileName - 파일명
     * @returns {string|null} 파일 타입
     */
    static getTypeFromFileName(fileName) {
        for (const [type, config] of Object.entries(FILE_TYPE_MAPPING)) {
            const fileNames = Array.isArray(config.fileName) ? config.fileName : [config.fileName];
            if (fileNames.includes(fileName)) {
                return type;
            }
        }
        return null;
    }

    /**
     * 가상 URI path에서 타입 추론
     * @param {string} virtualPath - 가상 경로 (예: "appName [UI]")
     * @returns {string|null} 파일 타입
     */
    static getTypeFromVirtualPath(virtualPath) {
        for (const [type, config] of Object.entries(FILE_TYPE_MAPPING)) {
            if (virtualPath.includes(`[${config.label}]`)) {
                return type;
            }
        }
        return null;
    }

    /**
     * 안전하게 파일 생성
     * @param {string} filePath - 파일 경로
     * @param {string} content - 내용
     * @returns {boolean} 성공 여부
     */
    static safeWriteFile(filePath, content = '') {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        } catch (e) {
            console.error('Failed to write file:', e);
            return false;
        }
    }

    /**
     * 안전하게 JSON 파일 읽기
     * @param {string} filePath - 파일 경로
     * @returns {Object} 파싱된 JSON 또는 빈 객체
     */
    static safeReadJson(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (e) {
            console.error('Failed to read JSON:', e);
        }
        return {};
    }

    /**
     * 안전하게 JSON 파일 쓰기
     * @param {string} filePath - 파일 경로
     * @param {Object} data - 저장할 데이터
     * @returns {boolean} 성공 여부
     */
    static safeWriteJson(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
            return true;
        } catch (e) {
            console.error('Failed to write JSON:', e);
            return false;
        }
    }
}

module.exports = WizFileUtils;
