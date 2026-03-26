import React, { useEffect, useRef, useState } from 'react';

interface DateFilterPopupProps {
    anchorRect: DOMRect;
    dateFrom: string;
    dateTo: string;
    onApply: (dateFrom: string, dateTo: string) => void;
    onClose: () => void;
}

const POPUP_WIDTH = 260;
const GAP = 4;

function DateFilterPopup({ anchorRect, dateFrom, dateTo, onApply, onClose }: DateFilterPopupProps) {
    const [from, setFrom] = useState(dateFrom);
    const [to, setTo] = useState(dateTo);
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
        onApply(from, to);
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
                <span className="pfp-title">Filter by date</span>
                <button className="pfp-close" onClick={onClose}>✕</button>
            </div>

            <div className="dfp-body">
                <label className="dfp-label">
                    From
                    <input
                        autoFocus
                        className="dfp-input"
                        type="date"
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                    />
                </label>
                <label className="dfp-label">
                    To
                    <input
                        className="dfp-input"
                        type="date"
                        value={to}
                        onChange={e => setTo(e.target.value)}
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

export default DateFilterPopup;
