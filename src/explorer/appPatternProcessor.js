/**
 * App Pattern Processor (Refactored)
 * App 폴더 패턴 인식 및 그룹화
 */

const { APP_TYPES, FLAT_APP_TYPES } = require('../core');
const AppGroupItem = require('./treeItems/appGroupItem');

class AppPatternProcessor {
    static get TYPES() {
        return APP_TYPES.filter(type => !FLAT_APP_TYPES.includes(type));
    }

    /**
     * 아이템 목록에서 App 패턴 존재 여부 확인
     */
    static hasPattern(items) {
        return items.some(item => 
            this.TYPES.some(type => item.label.startsWith(`${type}.`))
        );
    }

    /**
     * 아이템 목록을 App 그룹으로 처리
     */
    static process(items, parentPath, groupIcon) {
        const appGroups = this.TYPES.map(type => 
            new AppGroupItem(type, parentPath, groupIcon)
        );

        const otherItems = items.filter(item =>  
            !this.TYPES.some(type => item.label.startsWith(`${type}.`))
        );

        return [...appGroups, ...otherItems];
    }
}

module.exports = AppPatternProcessor;
