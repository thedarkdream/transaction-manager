import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Transactions from '../components/Transactions';
import Pagination from '../components/Pagination';
import PartnerFilterPopup from '../components/PartnerFilterPopup';
import DateFilterPopup from '../components/DateFilterPopup';
import CategoryPickerModal from '../components/CategoryPickerModal';
import { Node } from '../components/Categories';
import { PagedResult, PartnerPickerDto, TransactionDto } from '../ApiModel';
import { API_BASE } from '../config';

const PAGE_SIZE = 50;

function TransactionsPage() {

    const [searchParams, setSearchParams] = useSearchParams();

    const [transactions, setTransactions] = useState<TransactionDto[]>();
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [errorState, setErrorState] = useState<string>();
    const [partners, setPartners] = useState<PartnerPickerDto[]>([]);
    const [categories, setCategories] = useState<Node[]>([]);
    const [partnerFilterAnchor, setPartnerFilterAnchor] = useState<DOMRect | null>(null);
    const [dateFilterAnchor, setDateFilterAnchor] = useState<DOMRect | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    // Partner filter is stored in the URL as ?partnerIds=1,2,3
    const selectedPartnerIds: number[] = (searchParams.get('partnerIds') ?? '')
        .split(',')
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n));

    // Date filter is stored in the URL as ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';

    useEffect(() => {
        fetch(`${API_BASE}/partners`)
            .then(r => r.json())
            .then((data: PartnerPickerDto[]) => setPartners(data))
            .catch(err => console.error('Failed to load partners', err));
        fetch(`${API_BASE}/categories`)
            .then(r => r.json())
            .then((data: Node[]) => setCategories(data))
            .catch(err => console.error('Failed to load categories', err));
    }, []);

    const partnerIdsParam = searchParams.get('partnerIds') ?? '';

    useEffect(() => {
        setErrorState(undefined);
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (selectedPartnerIds.length > 0) {
            params.set('partnerIds', selectedPartnerIds.join(','));
        }
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        fetch(`${API_BASE}/transactions?${params}`)
            .then(r => r.json())
            .then((result: PagedResult<TransactionDto>) => {
                setTransactions(result.data);
                setTotal(result.total);
                setSelectedIds(new Set()); // clear selection on page/filter change
            })
            .catch(err => setErrorState(err.message));
    }, [page, partnerIdsParam, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

    function handlePageChange(p: number): void {
        setPage(p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handlePartnerFilterApply(ids: number[]): void {
        const next = new URLSearchParams(searchParams);
        if (ids.length > 0) {
            next.set('partnerIds', ids.join(','));
        } else {
            next.delete('partnerIds');
        }
        setSearchParams(next, { replace: true });
        setPage(1);
    }

    function handleDateFilterApply(from: string, to: string): void {
        const next = new URLSearchParams(searchParams);
        if (from) next.set('dateFrom', from); else next.delete('dateFrom');
        if (to) next.set('dateTo', to); else next.delete('dateTo');
        setSearchParams(next, { replace: true });
        setPage(1);
    }

    function toggleRow(id: number): void {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function toggleAll(): void {
        const allOnPage = transactions?.map(t => t.id) ?? [];
        const allSelected = allOnPage.every(id => selectedIds.has(id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allSelected) allOnPage.forEach(id => next.delete(id));
            else allOnPage.forEach(id => next.add(id));
            return next;
        });
    }

    async function handleAssignCategory(categoryId: number): Promise<void> {
        setShowCategoryPicker(false);
        await doAssign(categoryId);
    }

    async function handleRemoveCategory(): Promise<void> {
        await doAssign(null);
    }

    async function doAssign(categoryId: number | null): Promise<void> {
        try {
            const res = await fetch(`${API_BASE}/transactions/assign-category`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionIds: Array.from(selectedIds), categoryId }),
            });
            if (!res.ok) throw new Error(await res.text());
            setSelectedIds(new Set());
            // refresh current page
            setPage(p => p);
        } catch (err: unknown) {
            setErrorState((err as Error).message);
        }
    }

    async function handleBackfill(): Promise<void> {
        try {
            const res = await fetch(`${API_BASE}/transactions/backfill-categories`, { method: 'POST' });
            if (!res.ok) throw new Error(await res.text());
            const { updated } = await res.json();
            // Refresh the current view
            setPage(p => p);
            alert(`Backfill complete — ${updated} transaction${updated !== 1 ? 's' : ''} updated.`);
        } catch (err: unknown) {
            setErrorState((err as Error).message);
        }
    }

    const selectionCount = selectedIds.size;

    return (
        <div className="page">
            <h2>Transactions</h2>

            <div className="partners-toolbar">
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
                        title="Remove category from selected transactions"
                    >
                        Remove category
                    </button>
                    <button
                        className="btn btn-ghost"
                        onClick={handleBackfill}
                        title="Assign categories from partners to all uncategorised transactions"
                    >
                        Backfill from partners
                    </button>
                </div>
            </div>

            {errorState && <div className="error-msg">{errorState}</div>}
            {!errorState && (
                <>
                    <Transactions
                        entries={transactions}
                        selectedPartnerIds={selectedPartnerIds}
                        onOpenPartnerFilter={setPartnerFilterAnchor}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onOpenDateFilter={setDateFilterAnchor}
                        selectedIds={selectedIds}
                        onToggle={toggleRow}
                        onToggleAll={toggleAll}
                    />
                    <Pagination
                        page={page}
                        pageSize={PAGE_SIZE}
                        total={total}
                        onPageChange={handlePageChange}
                    />
                </>
            )}
            {partnerFilterAnchor !== null && (
                <PartnerFilterPopup
                    anchorRect={partnerFilterAnchor}
                    partners={partners}
                    selectedIds={selectedPartnerIds}
                    onApply={handlePartnerFilterApply}
                    onClose={() => setPartnerFilterAnchor(null)}
                />
            )}
            {dateFilterAnchor !== null && (
                <DateFilterPopup
                    anchorRect={dateFilterAnchor}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onApply={handleDateFilterApply}
                    onClose={() => setDateFilterAnchor(null)}
                />
            )}
            {showCategoryPicker && (
                <CategoryPickerModal
                    categories={categories}
                    title={`Assign category to ${selectionCount} transaction${selectionCount !== 1 ? 's' : ''}`}
                    onSelect={handleAssignCategory}
                    onClose={() => setShowCategoryPicker(false)}
                />
            )}
        </div>
    );
}

export default TransactionsPage;