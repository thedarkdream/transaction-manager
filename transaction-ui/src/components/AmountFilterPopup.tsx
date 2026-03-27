import React, { useEffect, useRef, useState } from 'react';

interface AmountFilterPopupProps {
    anchorRect: DOMRect;
    amountMin: string;
    amountMax: string;
    onApply: (amountMin: string, amountMax: string) => void;
    onClose: () => void;
}

const POPUP_WIDTH = 220;
const GAP = 4;

function AmountFilterPopup({ anchorRect, amountMin, amountMax, onApply, onClose }: AmountFilterPopupProps) {
    const [min, setMin] = useState(amountMin);
    const [max, setMax] = useState(amountMax);
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

    function handleApply() {
        onApply(min, max);
        onClose();
    }

    function handleClear() {
        onApply('', '');
        onClose();
    }

    let left = anchorRect.left;
    let top = anchorRect.bottom + GAP;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPUP_WIDTH - 8;
    }
    if (top + 200 > window.innerHeight - 8) {
        top = anchorRect.top - 200 - GAP;
    }

    return (
        <div
            ref={popupRef}
            className="date-filter-popup"
            style={{ position: 'fixed', left, top, width: POPUP_WIDTH }}
        >
            <div className="pfp-header">
                <span className="pfp-title">Filter by amount</span>
                <button className="pfp-close" onClick={onClose}>✕</button>
            </div>

            <div className="dfp-body">
                <label className="dfp-label">
                    Min
                    <input
                        autoFocus
                        className="dfp-input"
                        type="number"
                        step="0.01"
                        placeholder="e.g. -500"
                        value={min}
                        onChange={e => setMin(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleApply()}
                    />
                </label>
                <label className="dfp-label">
                    Max
                    <input
                        className="dfp-input"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 0"
                        value={max}
                        onChange={e => setMax(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleApply()}
                    />
                </label>
            </div>

            <div className="dfp-footer">
                <button className="btn btn-ghost pfp-action-btn" onClick={handleClear}>Clear</button>
                <button className="btn btn-primary pfp-action-btn" onClick={handleApply}>Apply</button>
            </div>
        </div>
    );
}

export default AmountFilterPopup;
