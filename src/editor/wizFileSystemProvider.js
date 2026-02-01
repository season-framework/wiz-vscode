/**
 * Wiz File System Provider (Refactored)
 * 가상 파일 시스템 제공자
 */

const vscode = require('vscode');
const fs = require('fs');
const { WizPathUtils } = require('../core');

class WizFileSystemProvider {
    constructor() {
        this._onDidChangeFile = new vscode.EventEmitter();
    }

    get onDidChangeFile() {
        return this._onDidChangeFile.event;
    }

    watch(uri, options) {
        return new vscode.Disposable(() => {});
    }

    stat(uri) {
        const realPath = WizPathUtils.getRealPathFromUri(uri);
        if (!realPath) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        
        try {
            const stat = fs.statSync(realPath);
            return {
                type: stat.isFile() ? vscode.FileType.File : vscode.FileType.Directory,
                ctime: stat.ctimeMs,
                mtime: stat.mtimeMs,
                size: stat.size
            };
        } catch (e) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    readDirectory(uri) {
        return [];
    }

    createDirectory(uri) {
        throw vscode.FileSystemError.NoPermissions();
    }

    readFile(uri) {
        const realPath = WizPathUtils.getRealPathFromUri(uri);
        if (!realPath) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
        
        try {
            return fs.readFileSync(realPath);
        } catch (e) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    writeFile(uri, content, options) {
        const realPath = WizPathUtils.getRealPathFromUri(uri);
        if (!realPath) {
            throw vscode.FileSystemError.NoPermissions();
        }
        
        try {
            fs.writeFileSync(realPath, content);
            this._onDidChangeFile.fire([{ type: vscode.FileChangeType.Changed, uri }]);
        } catch (e) {
            throw vscode.FileSystemError.NoPermissions();
        }
    }

    delete(uri) {
        throw vscode.FileSystemError.NoPermissions();
    }

    rename(oldUri, newUri, options) {
        throw vscode.FileSystemError.NoPermissions();
    }
}

module.exports = WizFileSystemProvider;
