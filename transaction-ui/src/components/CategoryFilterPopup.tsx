import React, { useEffect, useRef, useState } from 'react';
import { Node } from './Categories';

// null represents "no category" (unassigned partners)
export type CategoryFilterId = number | null;

interface CategoryFilterPopupProps {
    anchorRect: DOMRect;
    categories: Node[];
    selected: CategoryFilterId[];
    onApply: (ids: CategoryFilterId[]) => void;
    onClose: () => void;
}

const POPUP_WIDTH = 260;
const GAP = 4;

function flattenCategories(nodes: Node[]): Node[] {
    const result: Node[] = [];
    function walk(list: Node[]) {
        for (const n of list) {
            result.push(n);
            if (n.children?.length) walk(n.children);
        }
    }
    walk(nodes);
    return result;
}

function CategoryFilterPopup({ anchorRect, categories, selected, onApply, onClose }: CategoryFilterPopupProps) {
    const [checked, setChecked] = useState<Set<CategoryFilterId>>(new Set(selected));
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleMouseDown(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as globalThis.Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onClose]);

    const flat = flattenCategories(categories);

    function toggle(id: CategoryFilterId) {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function selectAll() {
        setChecked(new Set([null, ...flat.map(c => c.id as CategoryFilterId)]));
    }
    function clearAll() { setChecked(new Set()); }

    let left = anchorRect.left;
    let top = anchorRect.bottom + GAP;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPUP_WIDTH - 8;
    }

    return (
        <div
            ref={popupRef}
            className="filter-popup"
            style={{ position: 'fixed', left, top, width: POPUP_WIDTH }}
        >
            <div className="pfp-header">
                <span className="pfp-title">Filter by category</span>
                <button className="pfp-close" onClick={onClose}>✕</button>
            </div>

            <div className="pfp-actions">
                <button className="btn btn-ghost pfp-action-btn" onClick={selectAll}>Select all</button>
                <button className="btn btn-ghost pfp-action-btn" onClick={clearAll}>Clear</button>
            </div>

            <ul className="pfp-list">
                {/* No category option */}
                <li className="pfp-item" onClick={() => toggle(null)}>
                    <input
                        type="checkbox"
                        checked={checked.has(null)}
                        onChange={() => toggle(null)}
                        onClick={e => e.stopPropagation()}
                    />
                    <span className="cfp-dot" style={{ background: '#d1d5db' }} />
                    <span className="pfp-name" style={{ color: '#9ca3af' }}>No category</span>
                </li>

                {flat.map(cat => (
                    <li key={cat.id} className="pfp-item" onClick={() => toggle(cat.id)}>
                        <input
                            type="checkbox"
                            checked={checked.has(cat.id)}
                            onChange={() => toggle(cat.id)}
                            onClick={e => e.stopPropagation()}
                        />
                        <span className="cfp-dot" style={{ background: cat.color ?? '#9ca3af' }} />
                        <span className="pfp-name">{cat.name}</span>
                    </li>
                ))}
            </ul>

            <div className="pfp-footer">
                <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => onApply(Array.from(checked))}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}

export default CategoryFilterPopup;
