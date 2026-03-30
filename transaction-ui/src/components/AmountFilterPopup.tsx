import React, { useEffect, useRef, useState } from 'react';

interface AmountFilterPopupProps {
    anchorRect: DOMRect;
    amountMin: string;
    amountMax: string;
    boundsMin: number;
    boundsMax: number;
    onApply: (amountMin: string, amountMax: string) => void;
    onClose: () => void;
}

const POPUP_WIDTH = 300;
const GAP = 4;

function fmt(n: number): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function AmountFilterPopup({ anchorRect, amountMin, amountMax, boundsMin, boundsMax, onApply, onClose }: AmountFilterPopupProps) {
    const floorMin = Math.floor(boundsMin);
    const ceilMax = Math.ceil(boundsMax);

    const [low, setLow] = useState(amountMin !== '' ? parseFloat(amountMin) : floorMin);
    const [high, setHigh] = useState(amountMax !== '' ? parseFloat(amountMax) : ceilMax);

    // String shadows let the user type freely; numbers are clamped on commit (blur / Enter)
    const [lowText, setLowText] = useState(String(amountMin !== '' ? parseFloat(amountMin) : floorMin));
    const [highText, setHighText] = useState(String(amountMax !== '' ? parseFloat(amountMax) : ceilMax));

    function commitLow(raw: string) {
        const parsed = parseFloat(raw);
        const clamped = isNaN(parsed) ? floorMin : Math.max(floorMin, Math.min(parsed, high - 1));
        setLow(clamped);
        setLowText(String(clamped));
    }

    function commitHigh(raw: string) {
        const parsed = parseFloat(raw);
        const clamped = isNaN(parsed) ? ceilMax : Math.min(ceilMax, Math.max(parsed, low + 1));
        setHigh(clamped);
        setHighText(String(clamped));
    }

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
        const isFullRange = low <= floorMin && high >= ceilMax;
        onApply(isFullRange ? '' : String(low), isFullRange ? '' : String(high));
        onClose();
    }

    function handleClear() {
        onApply('', '');
        onClose();
    }

    const range = ceilMax - floorMin || 1;
    const leftPct = ((low - floorMin) / range) * 100;
    const rightPct = 100 - ((high - floorMin) / range) * 100;
    const mid = (floorMin + ceilMax) / 2;

    let left = anchorRect.left;
    let top = anchorRect.bottom + GAP;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
        left = window.innerWidth - POPUP_WIDTH - 8;
    }
    if (top + 220 > window.innerHeight - 8) {
        top = anchorRect.top - 220 - GAP;
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

            <div className="afp-body">
                <div className="afp-values">
                    <input
                        className="afp-value-input"
                        type="number"
                        value={lowText}
                        onChange={e => setLowText(e.target.value)}
                        onBlur={e => commitLow(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitLow(lowText); }}
                    />
                    <span className="afp-value-sep">–</span>
                    <input
                        className="afp-value-input"
                        type="number"
                        value={highText}
                        onChange={e => setHighText(e.target.value)}
                        onBlur={e => commitHigh(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitHigh(highText); }}
                    />
                </div>

                <div className="afp-slider-wrap">
                    <div className="afp-track">
                        <div className="afp-fill" style={{ left: `${leftPct}%`, right: `${rightPct}%` }} />
                    </div>
                    <input
                        className="afp-range"
                        type="range"
                        style={{ zIndex: low > mid ? 2 : 1 }}
                        min={floorMin}
                        max={ceilMax}
                        step={1}
                        value={low}
                        onChange={e => { const v = Math.min(Number(e.target.value), high - 1); setLow(v); setLowText(String(v)); }}
                    />
                    <input
                        className="afp-range"
                        type="range"
                        style={{ zIndex: high < mid ? 2 : 1 }}
                        min={floorMin}
                        max={ceilMax}
                        step={1}
                        value={high}
                        onChange={e => { const v = Math.max(Number(e.target.value), low + 1); setHigh(v); setHighText(String(v)); }}
                    />
                </div>

                <div className="afp-bounds">
                    <span>{fmt(floorMin)}</span>
                    <span>{fmt(ceilMax)}</span>
                </div>
            </div>

            <div className="dfp-footer">
                <button className="btn btn-ghost pfp-action-btn" onClick={handleClear}>Clear</button>
                <button className="btn btn-primary pfp-action-btn" onClick={handleApply}>Apply</button>
            </div>
        </div>
    );
}

export default AmountFilterPopup;
