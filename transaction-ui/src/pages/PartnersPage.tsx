import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CategoryPickerModal from '../components/CategoryPickerModal';
import CategoryFilterPopup, { CategoryFilterId } from '../components/CategoryFilterPopup';
import { Node } from '../components/Categories';
import { PartnerDetailDto } from '../ApiModel';
import { API_BASE } from '../config';

// ── URL param helpers ─────────────────────────────────────────────────────────

function parseCatIds(raw: string | null): CategoryFilterId[] {
    if (!raw) return [];
    return raw.split(',').map(s => (s === 'null' ? null : parseInt(s, 10)));
}

function serialiseCatIds(ids: CategoryFilterId[]): string {
    return ids.map(id => (id === null ? 'null' : String(id))).join(',');
}

const SCROLL_KEY = 'partners_scroll';

function PartnersPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Filter state lives in the URL so browser Back restores it automatically
    const search = searchParams.get('q') ?? '';
    const filterCatIds: CategoryFilterId[] = parseCatIds(searchParams.get('catIds'));

    const [partners, setPartners] = useState<PartnerDetailDto[]>([]);
    const [categories, setCategories] = useState<Node[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorState, setErrorState] = useState<string>();
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [catFilterAnchor, setCatFilterAnchor] = useState<DOMRect | null>(null);

    // Track whether we have already restored the scroll position for this visit
    const scrollRestored = useRef(false);

    useEffect(() => {
        Promise.all([
            fetch(`${API_BASE}/partners/all`).then(r => r.json()),
            fetch(`${API_BASE}/categories`).then(r => r.json()),
        ])
            .then(([partnerData, categoryData]: [PartnerDetailDto[], Node[]]) => {
                setPartners(partnerData);
                setCategories(categoryData);
            })
            .catch(err => setErrorState(err.message))
            .finally(() => setLoading(false));
    }, []);

    // Restore scroll after data has loaded (only once per visit)
    useEffect(() => {
        if (loading || scrollRestored.current) return;
        scrollRestored.current = true;
        const saved = sessionStorage.getItem(SCROLL_KEY);
        if (saved !== null) {
            const y = parseInt(saved, 10);
            // Use rAF to wait for the DOM to settle before scrolling
            requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }));
            sessionStorage.removeItem(SCROLL_KEY);
        }
    }, [loading]);

    // ── Helpers to update URL params ────────────────────────────────────────

    function setSearch(value: string) {
        const next = new URLSearchParams(searchParams);
        if (value) next.set('q', value); else next.delete('q');
        setSearchParams(next, { replace: true });
    }

    function setFilterCatIds(ids: CategoryFilterId[]) {
        const next = new URLSearchParams(searchParams);
        if (ids.length > 0) next.set('catIds', serialiseCatIds(ids)); else next.delete('catIds');
        setSearchParams(next, { replace: true });
    }

    const filtered = useMemo(() => {
        let result = partners;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(p =>
                (p.name ?? '').toLowerCase().includes(q) ||
                (p.iban ?? '').toLowerCase().includes(q)
            );
        }
        if (filterCatIds.length > 0) {
            const catSet = new Set(filterCatIds);
            result = result.filter(p =>
                p.category ? catSet.has(p.category.id) : catSet.has(null)
            );
        }
        return result;
    }, [partners, search, filterCatIds]);

    // --- Selection ---
    const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));
    const someFilteredSelected = filtered.some(p => selectedIds.has(p.id));

    function toggleSelectAll() {
        if (allFilteredSelected) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                filtered.forEach(p => next.delete(p.id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                filtered.forEach(p => next.add(p.id));
                return next;
            });
        }
    }

    function toggleRow(id: number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function handlePartnerClick(partnerId: number) {
        // Save scroll position before leaving so we can restore it on Back
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        navigate(`/transactions?partnerIds=${partnerId}`);
    }

    // --- Category assignment ---
    async function handleAssign(categoryId: number): Promise<void> {
        setShowCategoryPicker(false);
        await doAssign(categoryId);
    }

    async function handleRemoveCategory(): Promise<void> {
        await doAssign(null);
    }

    async function doAssign(categoryId: number | null): Promise<void> {
        const partnerIds = Array.from(selectedIds);
        try {
            const response = await fetch(`${API_BASE}/partners/assign-category`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerIds, categoryId }),
            });
            if (!response.ok) throw new Error(await response.text());

            // Optimistic update: refresh just the affected partners in local state
            const updatedPartnerData: PartnerDetailDto[] = await fetch(`${API_BASE}/partners/all`).then(r => r.json());
            setPartners(updatedPartnerData);
            setSelectedIds(new Set());
        } catch (err: unknown) {
            setErrorState((err as Error).message);
        }
    }

    const selectionCount = selectedIds.size;

    return (
        <div className="page">
            <h2>Partners</h2>

            {errorState && <div className="error-msg">{errorState}</div>}

            <div className="partners-toolbar">
                <input
                    className="partners-search"
                    type="text"
                    placeholder="Filter by name or IBAN…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <span className="partners-count">
                    {filtered.length} partner{filtered.length !== 1 ? 's' : ''}
                    {(search || filterCatIds.length > 0) && partners.length !== filtered.length ? ` (of ${partners.length})` : ''}
                </span>
                <button
                    className={`btn btn-ghost pfp-trigger-btn${filterCatIds.length > 0 ? ' pfp-trigger-btn--active' : ''}`}
                    onClick={e => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setCatFilterAnchor(prev => prev ? null : rect);
                    }}
                >
                    Category{filterCatIds.length > 0 ? ` (${filterCatIds.length})` : ''}
                </button>
                <div className="partners-actions">
                    {selectionCount > 0 && (
                        <span className="partners-selection-label">{selectionCount} selected</span>
                    )}
                    <button
                        className="btn btn-primary"
                        disabled={selectionCount === 0}
                        onClick={() => setShowCategoryPicker(true)}
                    >
                        Assign category
                    </button>
                    <button
                        className="btn btn-ghost"
                        disabled={selectionCount === 0}
                        onClick={handleRemoveCategory}
                        title="Remove category assignment from selected partners"
                    >
                        Remove category
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="empty-msg">Loading…</p>
            ) : (
                <table className="transactions-table partners-table">
                    <thead>
                        <tr>
                            <th className="col-check">
                                <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
                                    onChange={toggleSelectAll}
                                    title="Select all visible"
                                />
                            </th>
                            <th>Name</th>
                            <th>IBAN</th>
                            <th>BIC</th>
                            <th>Country</th>
                            <th>Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="empty-msg" style={{ padding: '16px' }}>
                                    No partners match.
                                </td>
                            </tr>
                        )}
                        {filtered.map(p => (
                            <tr
                                key={p.id}
                                className={selectedIds.has(p.id) ? 'row-selected' : ''}
                                onClick={() => toggleRow(p.id)}
                            >
                                <td className="col-check" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(p.id)}
                                        onChange={() => toggleRow(p.id)}
                                    />
                                </td>
                                <td
                                    className="partner-name-link"
                                    onClick={e => { e.stopPropagation(); handlePartnerClick(p.id); }}
                                    title="View transactions for this partner"
                                >
                                    {p.name ?? '—'}
                                </td>
                                <td className="col-mono">{p.iban ?? '—'}</td>
                                <td className="col-mono">{p.bic ?? '—'}</td>
                                <td>{p.country_code ?? '—'}</td>
                                <td>
                                    {p.category
                                        ? <span
                                            className="category-tag"
                                            style={{ background: p.category.color ?? '#9ca3af' }}
                                          >{p.category.name}</span>
                                        : <span className="no-category">—</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {showCategoryPicker && (
                <CategoryPickerModal
                    categories={categories}
                    title={`Assign category to ${selectionCount} partner${selectionCount !== 1 ? 's' : ''}`}
                    onSelect={handleAssign}
                    onClose={() => setShowCategoryPicker(false)}
                />
            )}

            {catFilterAnchor && (
                <CategoryFilterPopup
                    anchorRect={catFilterAnchor}
                    categories={categories}
                    selected={filterCatIds}
                    onApply={ids => { setFilterCatIds(ids); setCatFilterAnchor(null); }}
                    onClose={() => setCatFilterAnchor(null)}
                />
            )}
        </div>
    );
}

export default PartnersPage;
