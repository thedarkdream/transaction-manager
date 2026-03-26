import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { CategoryDto, MonthlyTotalDto } from '../ApiModel';
import { API_BASE } from '../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// directOnly = true  →  only transactions tagged exactly with this category id
// directOnly = false →  transactions tagged with this category OR any descendant
interface Slot {
    id: number;
    directOnly: boolean;
}

// ---------------------------------------------------------------------------
// Tree helpers (pure, module-level)
// ---------------------------------------------------------------------------

function findNode(nodes: CategoryDto[], id: number): CategoryDto | null {
    for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
    }
    return null;
}

// Returns set of id + all recursive descendants of node
function collectDescendantIds(node: CategoryDto): Set<number> {
    const ids = new Set<number>([node.id]);
    for (const child of node.children) {
        collectDescendantIds(child).forEach(id => ids.add(id));
    }
    return ids;
}

// Returns set of ALL descendant ids EXCLUDING the node itself
function collectChildDescendantIds(node: CategoryDto): Set<number> {
    const ids = new Set<number>();
    for (const child of node.children) {
        collectDescendantIds(child).forEach(id => ids.add(id));
    }
    return ids;
}

function generateMonths(from: string, to: string): string[] {
    const months: string[] = [];
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    let y = fy, m = fm;
    while (y < ty || (y === ty && m <= tm)) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return months;
}

// Default date range: last 12 months
function defaultFrom(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultTo(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Convert YYYY-MM to first/last-day ISO strings for the API
function monthToDateFrom(ym: string): string { return `${ym}-01`; }
function monthToDateTo(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    const last = new Date(y, m, 0);
    return `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function slotKey(s: Slot): string { return `${s.id}-${s.directOnly ? 'd' : 'n'}`; }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SpendingGraphPage() {
    const [dateFrom, setDateFrom] = useState<string>(defaultFrom);
    const [dateTo, setDateTo] = useState<string>(defaultTo);

    const [fetchedFrom, setFetchedFrom] = useState<string>(defaultFrom);
    const [fetchedTo, setFetchedTo] = useState<string>(defaultTo);

    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [totals, setTotals] = useState<MonthlyTotalDto[]>([]);
    const [activeSlots, setActiveSlots] = useState<Slot[]>([]);
    const [hiddenSlotKeys, setHiddenSlotKeys] = useState<Set<string>>(new Set());
    const [focusedId, setFocusedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    // Load categories once on mount
    useEffect(() => {
        fetch(`${API_BASE}/categories`)
            .then(r => r.json())
            .then((data: CategoryDto[]) => {
                setCategories(data);
                setActiveSlots(data.filter(c => c.parent === null).map(c => ({ id: c.id, directOnly: false })));
            })
            .catch(err => setError(err.message));
    }, []);

    const fetchTotals = useCallback((from: string, to: string) => {
        setLoading(true);
        setError(undefined);
        const params = new URLSearchParams({
            date_from: monthToDateFrom(from),
            date_to: monthToDateTo(to),
        });
        fetch(`${API_BASE}/transactions/monthly-totals?${params}`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then((data: MonthlyTotalDto[]) => {
                setTotals(data);
                setFetchedFrom(from);
                setFetchedTo(to);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchTotals(fetchedFrom, fetchedTo);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ---------------------------------------------------------------------------
    // Split / Merge
    // ---------------------------------------------------------------------------

    // Replace a normal slot with: its direct children (normal) + a directOnly slot for itself
    function splitSlot(id: number): void {
        const node = findNode(categories, id);
        if (!node || node.children.length === 0) return;
        setActiveSlots(prev => {
            const idx = prev.findIndex(s => s.id === id && !s.directOnly);
            if (idx === -1) return prev;
            const inserted: Slot[] = [
                ...node.children.map(c => ({ id: c.id, directOnly: false })),
                { id, directOnly: true },
            ];
            const next = [...prev];
            next.splice(idx, 1, ...inserted);
            return next;
        });
    }

    // Collapse all visible descendants + the directOnly(parentId) back into normal(parentId).
    // Can be triggered from any descendant slot or from the directOnly slot itself.
    function mergeSlot(slotId: number, isDirectOnly: boolean): void {
        // For a directOnly slot, the parent to collapse back to is slotId itself.
        // For a normal child slot, it's node.parent.
        const parentId = isDirectOnly
            ? slotId
            : findNode(categories, slotId)?.parent ?? null;
        if (parentId === null) return;
        const parentNode = findNode(categories, parentId);
        if (!parentNode) return;

        // Ids of every descendant of parentNode (excluding parent itself)
        const descIds = collectChildDescendantIds(parentNode);

        setActiveSlots(prev => {
            const firstIdx = prev.findIndex(s =>
                (s.id === parentId && s.directOnly) || descIds.has(s.id)
            );
            const filtered = prev.filter(s =>
                !(s.id === parentId && s.directOnly) && !descIds.has(s.id)
            );
            const insertAt = firstIdx !== -1 ? Math.min(firstIdx, filtered.length) : filtered.length;
            const result = [...filtered];
            result.splice(insertAt, 0, { id: parentId, directOnly: false });
            return result;
        });
    }

    function toggleSlotVisibility(slot: Slot): void {
        const key = slotKey(slot);
        setHiddenSlotKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    // ---------------------------------------------------------------------------
    // Chart data
    // ---------------------------------------------------------------------------

    const allMonths = useMemo(() => generateMonths(fetchedFrom, fetchedTo), [fetchedFrom, fetchedTo]);

    const focusedDescIds = useMemo(() => {
        if (focusedId === null) return null;
        const node = findNode(categories, focusedId);
        return node ? collectDescendantIds(node) : new Set([focusedId]);
    }, [focusedId, categories]);

    const visibleSlots = useMemo(
        () => activeSlots.filter(s =>
            !hiddenSlotKeys.has(slotKey(s)) &&
            (focusedDescIds === null || focusedDescIds.has(s.id))
        ),
        [activeSlots, hiddenSlotKeys, focusedDescIds]
    );

    const series = useMemo(() => {
        return visibleSlots.map(slot => {
            const node = findNode(categories, slot.id);
            if (slot.directOnly) {
                // Only transactions tagged exactly with this category
                const data = allMonths.map(month =>
                    totals
                        .filter(t => t.month === month && t.categoryId === slot.id)
                        .reduce((sum, t) => sum + t.total, 0)
                );
                return { name: `${node?.name ?? `#${slot.id}`} (direct)`, data };
            } else {
                const descIds = node ? collectDescendantIds(node) : new Set([slot.id]);
                const data = allMonths.map(month =>
                    totals
                        .filter(t => t.month === month && t.categoryId !== null && descIds.has(t.categoryId!))
                        .reduce((sum, t) => sum + t.total, 0)
                );
                return { name: node?.name ?? `#${slot.id}`, data };
            }
        });
    }, [visibleSlots, categories, totals, allMonths]);

    const slotColors = useMemo(() =>
        visibleSlots.map(slot => {
            const color = findNode(categories, slot.id)?.color ?? '#9ca3af';
            if (!slot.directOnly) return color;
            // Slightly lighten the direct slot colour so it's visually distinct
            return color + 'aa';
        }),
        [visibleSlots, categories]
    );

    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'line',
            toolbar: { show: true },
            zoom: { enabled: true },
            animations: { enabled: false },
        },
        stroke: {
            width: visibleSlots.map(s => s.directOnly ? 1 : 2),
            curve: 'smooth',
            dashArray: visibleSlots.map(s => s.directOnly ? 4 : 0),
        },
        colors: slotColors,
        xaxis: {
            categories: allMonths,
            labels: { rotate: -45, style: { fontSize: '11px' } },
        },
        yaxis: {
            labels: { formatter: (val: number) => val.toFixed(2) },
        },
        tooltip: {
            shared: true,
            intersect: false,
            y: { formatter: (val: number) => val.toFixed(2) },
        },
        legend: { show: false },
        markers: { size: 4 },
        grid: { borderColor: '#e2e8f0' },
    }), [allMonths, slotColors, visibleSlots]);

    // ---------------------------------------------------------------------------
    // Slot set (for O(1) lookup in the tree renderer)
    // ---------------------------------------------------------------------------

    const activeSlotSet = useMemo(
        () => new Set(activeSlots.map(slotKey)),
        [activeSlots]
    );

    // ---------------------------------------------------------------------------
    // Tree renderer
    // ---------------------------------------------------------------------------

    function renderCatNode(catNode: CategoryDto, depth: number): React.ReactNode {
        const normalKey = slotKey({ id: catNode.id, directOnly: false });
        const directKey = slotKey({ id: catNode.id, directOnly: true });
        const hasNormal = activeSlotSet.has(normalKey);
        const hasDirect = activeSlotSet.has(directKey);
        const isExpanded = hasDirect;

        if (!hasNormal && !hasDirect) return null;

        const color = catNode.color ?? '#9ca3af';
        const normalSlot: Slot = { id: catNode.id, directOnly: false };
        const directSlot: Slot = { id: catNode.id, directOnly: true };
        const normalHidden = hiddenSlotKeys.has(normalKey);
        const directHidden = hiddenSlotKeys.has(directKey);
        const indent = depth * 20;
        const isFocused = focusedId === catNode.id;
        const isDimmed = focusedId !== null && focusedDescIds !== null && !focusedDescIds.has(catNode.id);

        return (
            <React.Fragment key={catNode.id}>
                {/* Parent row */}
                <div
                    className={`gst-row${isExpanded ? ' gst-row-expanded' : ''}${hasNormal && normalHidden ? ' gst-row-hidden' : ''}${isFocused ? ' gst-row-focused' : ''}${isDimmed ? ' gst-row-dimmed' : ''}`}
                    style={{ paddingLeft: indent }}
                >
                    {catNode.children.length > 0 ? (
                        <button
                            className="gst-expand-btn"
                            onClick={() => isExpanded ? mergeSlot(catNode.id, true) : splitSlot(catNode.id)}
                            title={isExpanded ? 'Collapse subcategories' : 'Expand into subcategories'}
                        >
                            {isExpanded ? '▾' : '▸'}
                        </button>
                    ) : (
                        <span className="gst-expand-spacer" />
                    )}
                    <span className="gst-dot" style={{ background: color }} />
                    <span
                        className={`gst-name gst-name-clickable${isFocused ? ' gst-name-focused' : ''}`}
                        onClick={() => setFocusedId(prev => prev === catNode.id ? null : catNode.id)}
                        title={isFocused ? 'Click to clear focus' : 'Click to focus graph on this category'}
                    >
                        {catNode.name ?? `#${catNode.id}`}
                    </span>
                    {hasNormal && (
                        <button
                            className={`gst-vis-btn${normalHidden ? ' gst-vis-btn-off' : ''}`}
                            onClick={() => toggleSlotVisibility(normalSlot)}
                            title={normalHidden ? 'Show line' : 'Hide line'}
                        >
                            {normalHidden ? '◻' : '◼'}
                        </button>
                    )}
                </div>

                {/* Children (only when expanded) */}
                {isExpanded && (
                    <>
                        {catNode.children.map(child => renderCatNode(child, depth + 1))}
                        {/* Direct transactions row */}
                        <div
                            className={`gst-row gst-row-direct${directHidden ? ' gst-row-hidden' : ''}`}
                            style={{ paddingLeft: (depth + 1) * 20 }}
                        >
                            <span className="gst-expand-spacer" />
                            <span className="gst-dot gst-dot-direct" style={{ background: color }} />
                            <span className="gst-name gst-name-direct">
                                {catNode.name ?? `#${catNode.id}`}
                                <span className="gst-direct-label"> (direct)</span>
                            </span>
                            <button
                                className={`gst-vis-btn${directHidden ? ' gst-vis-btn-off' : ''}`}
                                onClick={() => toggleSlotVisibility(directSlot)}
                                title={directHidden ? 'Show line' : 'Hide line'}
                            >
                                {directHidden ? '◻' : '◼'}
                            </button>
                        </div>
                    </>
                )}
            </React.Fragment>
        );
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className="page">
            <h2>Spending Graph</h2>

            <div className="graph-toolbar">
                <label className="graph-toolbar-label">
                    From
                    <input
                        type="month"
                        className="graph-month-input"
                        value={dateFrom}
                        max={dateTo}
                        onChange={e => setDateFrom(e.target.value)}
                    />
                </label>
                <label className="graph-toolbar-label">
                    To
                    <input
                        type="month"
                        className="graph-month-input"
                        value={dateTo}
                        min={dateFrom}
                        onChange={e => setDateTo(e.target.value)}
                    />
                </label>
                <button
                    className="btn btn-primary"
                    disabled={loading || !dateFrom || !dateTo}
                    onClick={() => fetchTotals(dateFrom, dateTo)}
                >
                    {loading ? 'Loading…' : 'Load'}
                </button>
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="graph-card">
                {series.length > 0 ? (
                    <ReactApexChart
                        type="line"
                        series={series}
                        options={chartOptions}
                        height={400}
                    />
                ) : (
                    <p className="empty-msg">No data. Select a date range and click Load.</p>
                )}
            </div>

            {/* Category slot tree */}
            <div className="graph-slot-tree">
                {categories.map(catNode => renderCatNode(catNode, 0))}
            </div>
        </div>
    );
}

export default SpendingGraphPage;
