import React, { useEffect, useRef, useState } from 'react';
import { PartnerPickerDto } from '../ApiModel';

interface PartnerFilterPopupProps {
    anchorRect: DOMRect;
    partners: PartnerPickerDto[];
    selectedIds: number[];
    onApply: (ids: number[]) => void;
    onClose: () => void;
}

const POPUP_WIDTH = 320;
const POPUP_MAX_HEIGHT = 420;
const GAP = 4;

function PartnerFilterPopup({ anchorRect, partners, selectedIds, onApply, onClose }: PartnerFilterPopupProps) {
    const [search, setSearch] = useState('');
    const [checked, setChecked] = useState<Set<number>>(new Set(selectedIds));
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleMouseDown(e: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [onClose]);

    const filtered = partners.filter(p => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (p.name ?? '').toLowerCase().includes(q) || (p.iban ?? '').toLowerCase().includes(q);
    });

    function toggle(id: number) {
        setChecked(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function selectAll() { setChecked(new Set(filtered.map(p => p.id))); }
    function clearAll() { setChecked(new Set()); }

    let left = anchorRect.left;
    let top = anchorRect.bottom + GAP;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPUP_WIDTH - 8;
    }
    if (top + POPUP_MAX_HEIGHT > window.innerHeight - 8) {
        top = anchorRect.top - POPUP_MAX_HEIGHT - GAP;
    }

    return (
        <div
            ref={popupRef}
            className="partner-filter-popup"
            style={{ position: 'fixed', left, top, width: POPUP_WIDTH }}
        >
            <div className="pfp-header">
                <span className="pfp-title">Filter by partner</span>
                <button className="pfp-close" onClick={onClose}>✕</button>
            </div>

            <div className="pfp-search-row">
                <input
                    autoFocus
                    className="pfp-search"
                    type="text"
                    placeholder="Search by name or IBAN…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="pfp-actions">
                <button className="btn btn-ghost pfp-action-btn" onClick={selectAll}>
                    Select all{search ? ' filtered' : ''}
                </button>
                <button className="btn btn-ghost pfp-action-btn" onClick={clearAll}>Clear</button>
            </div>

            <ul className="pfp-list">
                {filtered.length === 0 && (
                    <li className="pfp-empty">No partners match</li>
                )}
                {filtered.map(p => (
                    <li key={p.id} className="pfp-item" onClick={() => toggle(p.id)}>
                        <input
                            type="checkbox"
                            checked={checked.has(p.id)}
                            onChange={() => toggle(p.id)}
                            onClick={e => e.stopPropagation()}
                        />
                        <span className="pfp-name">{p.name ?? p.iban ?? `#${p.id}`}</span>
                        {p.name && p.iban && <span className="pfp-iban">{p.iban}</span>}
                    </li>
                ))}
            </ul>

            <div className="pfp-footer">
                <span className="pfp-count">
                    {checked.size > 0 ? `${checked.size} selected` : 'All partners'}
                </span>
                <button
                    className="btn btn-primary"
                    onClick={() => { onApply(Array.from(checked)); onClose(); }}
                >
                    Apply
                </button>
            </div>
        </div>
    );
}

export default PartnerFilterPopup;
