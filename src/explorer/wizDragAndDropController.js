/**
 * Drag and Drop Controller for Wiz Explorer
 * 일반 폴더에서만 드래그 앤 드롭 허용 (앱 폴더 제외)
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const DRAG_MIME_TYPE = 'application/vnd.code.tree.wizExplorer';

class WizDragAndDropController {
    constructor(fileExplorerProvider) {
        this.provider = fileExplorerProvider;
        this.dropMimeTypes = [DRAG_MIME_TYPE, 'text/uri-list'];
        this.dragMimeTypes = [DRAG_MIME_TYPE];
    }

    /**
     * 드래그 가능 여부 판단 및 데이터 설정
     */
    handleDrag(source, dataTransfer, token) {
        // 드래그 가능한 아이템만 필터링 (일반 file/folder만)
        const draggableItems = source.filter(item => this.isDraggable(item));
        
        if (draggableItems.length === 0) {
            return;
        }

        const uris = draggableItems.map(item => item.resourceUri.toString());
        dataTransfer.set(DRAG_MIME_TYPE, new vscode.DataTransferItem(JSON.stringify(uris)));
    }

    /**
     * 드롭 처리
     */
    async handleDrop(target, dataTransfer, token) {
        // 드롭 대상이 유효한 폴더인지 확인
        if (!target || !this.isDropTarget(target)) {
            return;
        }

        const targetPath = target.resourceUri.fsPath;

        // 드롭 대상 폴더가 없으면 생성
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        
        // 내부 드래그 데이터 확인
        const transferItem = dataTransfer.get(DRAG_MIME_TYPE);
        if (!transferItem) {
            return;
        }

        const uris = JSON.parse(await transferItem.asString());
        
        for (const uriStr of uris) {
            const uri = vscode.Uri.parse(uriStr);
            const sourcePath = uri.fsPath;
            const fileName = path.basename(sourcePath);
            const destPath = path.join(targetPath, fileName);

            // 같은 경로면 스킵
            if (sourcePath === destPath) {
                continue;
            }

            // 자기 자신 안으로 이동 방지
            if (destPath.startsWith(sourcePath + path.sep)) {
                vscode.window.showErrorMessage('Cannot move a folder into itself');
                continue;
            }

            // 이미 존재하는 경우 확인
            if (fs.existsSync(destPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `"${fileName}" already exists. Overwrite?`,
                    'Yes', 'No'
                );
                if (overwrite !== 'Yes') {
                    continue;
                }
            }

            try {
                fs.renameSync(sourcePath, destPath);
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to move: ${err.message}`);
            }
        }

        this.provider.refresh();
    }

    /**
     * 아이템이 드래그 가능한지 확인
     * 앱 관련 아이템은 드래그 불가
     */
    isDraggable(item) {
        const contextValue = item.contextValue;
        
        // 드래그 불가 컨텍스트
        const nonDraggable = [
            'appGroup',           // page/component/layout 그룹
            'appItem',            // 개별 앱 아이템
            'portalAppGroup',     // Portal App 그룹 폴더
            'portalRouteGroup',   // Portal Route 그룹 폴더
            'routeGroup',         // Source Route 그룹 폴더
            'category',           // source/packages/project 카테고리
            'noFolder',
            'openFolder',
            'switchProject'
        ];

        if (nonDraggable.includes(contextValue)) {
            return false;
        }

        // file 또는 folder만 드래그 가능
        return contextValue === 'file' || contextValue === 'folder';
    }

    /**
     * 드롭 대상으로 유효한지 확인
     * 일반 폴더 및 copilot/config 카테고리만 드롭 대상
     */
    isDropTarget(item) {
        // 폴더여야 함
        if (!item.isDirectory) {
            return false;
        }

        const contextValue = item.contextValue;

        // resourceUri가 있는 카테고리는 드롭 허용 (copilot, config)
        if ((contextValue === 'copilotCategory' || contextValue === 'configCategory') && item.resourceUri) {
            return true;
        }
        
        // 드롭 불가 컨텍스트
        const nonDroppable = [
            'appGroup',
            'appItem',
            'portalAppGroup',
            'portalRouteGroup',
            'routeGroup',
            'category'
        ];

        if (nonDroppable.includes(contextValue)) {
            return false;
        }

        return contextValue === 'folder';
    }
}

module.exports = WizDragAndDropController;
