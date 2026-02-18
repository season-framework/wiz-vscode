/**
 * FileManager - 파일/폴더 작업 비즈니스 로직
 * 파일 생성, 삭제, 복사, 붙여넣기, 이름 변경, 다운로드 담당
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const os = require('os');

class FileManager {
    /**
     * @param {Object} options
     * @param {Function} options.onRefresh - 트리 갱신 콜백
     * @param {Function} options.getWorkspaceRoot - 현재 워크스페이스 루트 반환 함수
     */
    constructor(options = {}) {
        this.onRefresh = options.onRefresh || (() => {});
        this.getWorkspaceRoot = options.getWorkspaceRoot || (() => undefined);
        this.clipboard = null;
    }

    /**
     * 새 파일 생성
     * @param {string} targetDir - 대상 디렉토리 경로
     */
    async createFile(targetDir) {
        const dir = targetDir || this.getWorkspaceRoot();
        if (!dir) return;

        const fileName = await vscode.window.showInputBox({ prompt: '새 파일 이름' });
        if (fileName) {
            const filePath = path.join(dir, fileName);
            try {
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(filePath, '', 'utf8');
                this.onRefresh();
            } catch (err) {
                vscode.window.showErrorMessage(`파일 생성 실패: ${err.message}`);
            }
        }
    }

    /**
     * 새 폴더 생성
     * @param {string} targetDir - 대상 디렉토리 경로
     */
    async createFolder(targetDir) {
        const dir = targetDir || this.getWorkspaceRoot();
        if (!dir) return;

        const folderName = await vscode.window.showInputBox({ prompt: '새 폴더 이름' });
        if (folderName) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                fs.mkdirSync(path.join(dir, folderName), { recursive: true });
                this.onRefresh();
            } catch (err) {
                vscode.window.showErrorMessage(`폴더 생성 실패: ${err.message}`);
            }
        }
    }

    /**
     * 파일/폴더 삭제
     * @param {string} targetPath - 삭제할 경로
     * @param {Object} options
     * @param {Function} options.onDeleted - 삭제 후 콜백 (deletedPath) => void
     * @returns {Promise<boolean>} 삭제 성공 여부
     */
    async delete(targetPath, options = {}) {
        if (!targetPath) return false;

        const name = path.basename(targetPath);
        const confirm = await vscode.window.showWarningMessage(
            `'${name}'을(를) 삭제하시겠습니까?`,
            { modal: true },
            '삭제'
        );

        if (confirm === '삭제') {
            try {
                fs.rmSync(targetPath, { recursive: true, force: true });
                
                if (options.onDeleted) {
                    options.onDeleted(targetPath);
                }
                
                this.onRefresh();
                return true;
            } catch (e) {
                vscode.window.showErrorMessage(`삭제 실패: ${e.message}`);
                return false;
            }
        }
        return false;
    }

    /**
     * 파일/폴더 복사 (클립보드에 저장)
     * @param {string} sourcePath - 복사할 경로
     */
    copy(sourcePath) {
        if (sourcePath) {
            this.clipboard = sourcePath;
            vscode.window.showInformationMessage(`복사됨: ${path.basename(sourcePath)}`);
        }
    }

    /**
     * 파일/폴더 붙여넣기
     * @param {string} targetDir - 대상 디렉토리 경로
     * @returns {Promise<boolean>} 성공 여부
     */
    async paste(targetDir) {
        if (!this.clipboard || !fs.existsSync(this.clipboard)) {
            vscode.window.showErrorMessage('복사된 항목이 없습니다.');
            return false;
        }

        const dir = targetDir || this.getWorkspaceRoot();
        if (!dir) return false;

        const baseName = path.basename(this.clipboard);
        let targetPath = path.join(dir, baseName);

        // 중복 이름 처리
        let counter = 1;
        while (fs.existsSync(targetPath)) {
            const ext = path.extname(baseName);
            const name = path.basename(baseName, ext);
            targetPath = path.join(dir, `${name}_copy${counter}${ext}`);
            counter++;
        }

        try {
            if (fs.statSync(this.clipboard).isDirectory()) {
                fs.cpSync(this.clipboard, targetPath, { recursive: true });
            } else {
                fs.copyFileSync(this.clipboard, targetPath);
            }
            this.onRefresh();
            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`붙여넣기 실패: ${err.message}`);
            return false;
        }
    }

    /**
     * 파일/폴더 이름 변경
     * @param {string} oldPath - 기존 경로
     * @param {Object} options
     * @param {boolean} options.isPortalPackage - 포탈 패키지 여부
     * @returns {Promise<boolean>} 성공 여부
     */
    async rename(oldPath, options = {}) {
        if (!oldPath) return false;

        const oldName = path.basename(oldPath);
        const parentDir = path.dirname(oldPath);
        const isPortalPackage = options.isPortalPackage || false;

        const newName = await vscode.window.showInputBox({
            title: '이름 변경',
            prompt: '새 이름을 입력하세요',
            value: oldName,
            validateInput: (value) => {
                if (!value) return '이름은 필수입니다.';
                if (value === oldName) return null;
                
                // 포탈 패키지는 영문 소문자와 숫자만 허용
                if (isPortalPackage && !/^[a-z][a-z0-9]*$/.test(value)) {
                    return '패키지 이름은 영문 소문자로 시작하고, 영문 소문자와 숫자만 허용됩니다.';
                }
                
                const newPath = path.join(parentDir, value);
                if (fs.existsSync(newPath)) {
                    return '이미 존재하는 이름입니다.';
                }
                return null;
            }
        });

        if (!newName || newName === oldName) return false;

        const newPath = path.join(parentDir, newName);

        try {
            fs.renameSync(oldPath, newPath);

            // 포탈 패키지인 경우 portal.json의 package 필드도 업데이트
            if (isPortalPackage) {
                this._updatePortalJson(newPath, newName);
            }

            this.onRefresh();
            vscode.window.showInformationMessage(`'${oldName}' → '${newName}' 이름이 변경되었습니다.`);
            return true;
        } catch (e) {
            vscode.window.showErrorMessage(`이름 변경 실패: ${e.message}`);
            return false;
        }
    }

    /**
     * portal.json의 package 필드 업데이트
     * @param {string} packagePath - 패키지 경로
     * @param {string} newName - 새 이름
     * @private
     */
    _updatePortalJson(packagePath, newName) {
        const portalJsonPath = path.join(packagePath, 'portal.json');
        if (fs.existsSync(portalJsonPath)) {
            try {
                const portalJson = JSON.parse(fs.readFileSync(portalJsonPath, 'utf8'));
                portalJson.package = newName;
                fs.writeFileSync(portalJsonPath, JSON.stringify(portalJson, null, 4), 'utf8');
            } catch (e) {
                // portal.json 업데이트 실패해도 이름 변경은 성공으로 처리
            }
        }
    }

    /**
     * 파일/폴더 다운로드
     * @param {string} sourcePath - 다운로드할 경로
     * @param {Object} options
     * @param {string} options.contextValue - 트리 아이템의 contextValue
     * @returns {Promise<boolean>} 성공 여부
     */
    async download(sourcePath, options = {}) {
        if (!sourcePath) {
            vscode.window.showErrorMessage('다운로드할 파일을 선택해주세요.');
            return false;
        }

        try {
            const fileName = path.basename(sourcePath);
            const isDirectory = fs.statSync(sourcePath).isDirectory();
            const isPortalPackage = options.contextValue === 'portalPackage';
            const isAppItem = options.contextValue === 'appItem';
            
            // 파일 확장자 및 필터 설정
            let defaultFileName;
            let filters;
            
            if (isPortalPackage) {
                defaultFileName = `${fileName}.wizpkg`;
                filters = { 'Wiz Package': ['wizpkg'] };
            } else if (isAppItem) {
                defaultFileName = `${fileName}.wizapp`;
                filters = { 'Wiz App': ['wizapp'] };
            } else if (isDirectory) {
                defaultFileName = `${fileName}.zip`;
                filters = { 'ZIP Archive': ['zip'] };
            } else {
                const ext = path.extname(fileName).slice(1) || 'file';
                defaultFileName = fileName;
                filters = { [ext.toUpperCase()]: [ext], 'All Files': ['*'] };
            }
            
            // 저장 다이얼로그 표시
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultFileName),
                filters: filters,
                title: '다운로드 위치 선택'
            });
            
            if (!saveUri) return false;
            
            if (isPortalPackage || isAppItem || isDirectory) {
                await this._downloadAsZip(sourcePath, saveUri, fileName, isPortalPackage || isAppItem);
            } else {
                await this._downloadFile(sourcePath, saveUri);
            }
            
            vscode.window.showInformationMessage(`'${path.basename(saveUri.fsPath)}' 다운로드 완료`);
            return true;
        } catch (err) {
            vscode.window.showErrorMessage(`다운로드 실패: ${err.message}`);
            return false;
        }
    }

    /**
     * 폴더를 ZIP으로 압축하여 다운로드
     * @private
     */
    async _downloadAsZip(sourcePath, saveUri, fileName, includePrefix) {
        const archiver = require('archiver');
        
        // OS tmp 디렉토리에 먼저 압축 파일 생성
        const tmpDir = os.tmpdir();
        const tmpFileName = `wiz_download_${Date.now()}_${path.basename(saveUri.fsPath)}`;
        const tmpPath = path.join(tmpDir, tmpFileName);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `'${fileName}' 압축 중...`,
            cancellable: false
        }, async () => {
            return new Promise((resolve, reject) => {
                const output = fs.createWriteStream(tmpPath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                output.on('close', () => resolve());
                archive.on('error', (err) => reject(err));

                archive.pipe(output);
                archive.glob('**/*', { 
                    cwd: sourcePath,
                    ignore: ['.git/**', 'node_modules/**']
                }, { prefix: includePrefix ? fileName : '' });
                archive.finalize();
            });
        });
        
        // tmp 파일을 사용자가 선택한 위치로 복사
        const tmpFileContent = fs.readFileSync(tmpPath);
        await vscode.workspace.fs.writeFile(saveUri, tmpFileContent);
        
        // tmp 파일 삭제
        fs.unlinkSync(tmpPath);
    }

    /**
     * 단일 파일 다운로드
     * @private
     */
    async _downloadFile(sourcePath, saveUri) {
        const fileContent = fs.readFileSync(sourcePath);
        await vscode.workspace.fs.writeFile(saveUri, fileContent);
    }

    /**
     * 파일/폴더 업로드 (Webview 사용)
     * @param {string} targetDir - 업로드 대상 디렉토리
     * @param {vscode.ExtensionContext} context - 확장 컨텍스트
     * @returns {Promise<boolean>} 성공 여부
     */
    async upload(targetDir, context) {
        if (!targetDir) {
            vscode.window.showErrorMessage('업로드할 폴더를 선택해주세요.');
            return false;
        }

        // 디렉토리가 없으면 생성
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const { UploadWebview } = require('../../core');

        const panel = vscode.window.createWebviewPanel(
            'wizUpload',
            '파일 업로드',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = UploadWebview.getMultiUploadHtml({
            title: '파일 업로드',
            targetPath: targetDir
        });

        const onRefresh = this.onRefresh;

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'uploadFiles':
                        try {
                            const files = message.files;
                            let uploadedCount = 0;

                            for (const fileInfo of files) {
                                const relativePath = fileInfo.relativePath;
                                const filePath = path.join(targetDir, relativePath);
                                const fileDir = path.dirname(filePath);

                                // 디렉토리 생성
                                if (!fs.existsSync(fileDir)) {
                                    fs.mkdirSync(fileDir, { recursive: true });
                                }

                                // Base64 디코딩 및 파일 저장
                                const buffer = Buffer.from(fileInfo.data, 'base64');
                                fs.writeFileSync(filePath, buffer);
                                uploadedCount++;
                            }

                            panel.webview.postMessage({
                                command: 'uploadComplete',
                                message: `${uploadedCount}개 파일 업로드 완료!`
                            });

                            onRefresh();
                        } catch (err) {
                            panel.webview.postMessage({
                                command: 'uploadError',
                                message: `업로드 실패: ${err.message}`
                            });
                        }
                        break;

                    case 'close':
                        panel.dispose();
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        return true;
    }
}

module.exports = FileManager;
