import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CategoryPickerModal from '../components/CategoryPickerModal';
import { Node } from '../components/Categories';
import { PartnerDetailDto } from '../ApiModel';
import { API_BASE } from '../config';

function PartnersPage() {
    const navigate = useNavigate();
    const [partners, setPartners] = useState<PartnerDetailDto[]>([]);
    const [categories, setCategories] = useState<Node[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorState, setErrorState] = useState<string>();
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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

    const filtered = useMemo(() => {
        if (!search.trim()) return partners;
        const q = search.toLowerCase();
        return partners.filter(p =>
            (p.name ?? '').toLowerCase().includes(q) ||
            (p.iban ?? '').toLowerCase().includes(q)
        );
    }, [partners, search]);

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
                    {search && partners.length !== filtered.length ? ` (of ${partners.length})` : ''}
                </span>
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
                                    onClick={e => { e.stopPropagation(); navigate(`/transactions?partnerIds=${p.id}`); }}
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
        </div>
    );
}

export default PartnersPage;
