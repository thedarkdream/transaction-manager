import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Transactions from '../components/Transactions';
import Pagination from '../components/Pagination';
import PartnerFilterPopup from '../components/PartnerFilterPopup';
import DateFilterPopup from '../components/DateFilterPopup';
import AmountFilterPopup from '../components/AmountFilterPopup';
import CategoryPickerModal from '../components/CategoryPickerModal';
import { Node } from '../components/Categories';
import { TransactionPagedResult, PartnerPickerDto, TransactionDto, AmountBoundsDto } from '../ApiModel';
import { API_BASE } from '../config';

const PAGE_SIZE = 50;

function TransactionsPage() {

    const [searchParams, setSearchParams] = useSearchParams();

    const [transactions, setTransactions] = useState<TransactionDto[]>();
    const [total, setTotal] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);
    const [totalIncoming, setTotalIncoming] = useState(0);
    const [page, setPage] = useState(1);
    const [errorState, setErrorState] = useState<string>();
    const [partners, setPartners] = useState<PartnerPickerDto[]>([]);
    const [categories, setCategories] = useState<Node[]>([]);
    const [amountBounds, setAmountBounds] = useState<AmountBoundsDto>({ min: -10000, max: 10000 });
    const [partnerFilterAnchor, setPartnerFilterAnchor] = useState<DOMRect | null>(null);
    const [dateFilterAnchor, setDateFilterAnchor] = useState<DOMRect | null>(null);
    const [amountFilterAnchor, setAmountFilterAnchor] = useState<DOMRect | null>(null);
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

    // Amount filter is stored in the URL as ?amountMin=...&amountMax=...
    const amountMin = searchParams.get('amountMin') ?? '';
    const amountMax = searchParams.get('amountMax') ?? '';

    useEffect(() => {
        fetch(`${API_BASE}/partners`)
            .then(r => r.json())
            .then((data: PartnerPickerDto[]) => setPartners(data))
            .catch(err => console.error('Failed to load partners', err));
        fetch(`${API_BASE}/categories`)
            .then(r => r.json())
            .then((data: Node[]) => setCategories(data))
            .catch(err => console.error('Failed to load categories', err));
        fetch(`${API_BASE}/transactions/amount-bounds`)
            .then(r => r.json())
            .then((data: AmountBoundsDto) => setAmountBounds(data))
            .catch(err => console.error('Failed to load amount bounds', err));
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
        if (amountMin) params.set('amount_min', amountMin);
        if (amountMax) params.set('amount_max', amountMax);
        fetch(`${API_BASE}/transactions?${params}`)
            .then(r => r.json())
            .then((result: TransactionPagedResult) => {
                setTransactions(result.data);
                setTotal(result.total);
                setTotalSpent(result.totalSpent);
                setTotalIncoming(result.totalIncoming);
                setSelectedIds(new Set()); // clear selection on page/filter change
            })
            .catch(err => setErrorState(err.message));
    }, [page, partnerIdsParam, dateFrom, dateTo, amountMin, amountMax]); // eslint-disable-line react-hooks/exhaustive-deps

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

    function handleAmountFilterApply(min: string, max: string): void {
        const next = new URLSearchParams(searchParams);
        if (min) next.set('amountMin', min); else next.delete('amountMin');
        if (max) next.set('amountMax', max); else next.delete('amountMax');
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
                    <div className="tx-summary">
                        <div className="tx-summary-item tx-summary-incoming">
                            <span className="tx-summary-label">Incoming</span>
                            <span className="tx-summary-value">+{totalIncoming.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="tx-summary-item tx-summary-spent">
                            <span className="tx-summary-label">Spent</span>
                            <span className="tx-summary-value">{totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="tx-summary-item tx-summary-net">
                            <span className="tx-summary-label">Net</span>
                            <span className="tx-summary-value">{(totalIncoming + totalSpent).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <Transactions
                        entries={transactions}
                        selectedPartnerIds={selectedPartnerIds}
                        onOpenPartnerFilter={setPartnerFilterAnchor}
                        dateFrom={dateFrom}
                        dateTo={dateTo}
                        onOpenDateFilter={setDateFilterAnchor}
                        amountMin={amountMin}
                        amountMax={amountMax}
                        onOpenAmountFilter={setAmountFilterAnchor}
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
            {amountFilterAnchor !== null && (
                <AmountFilterPopup
                    anchorRect={amountFilterAnchor}
                    amountMin={amountMin}
                    amountMax={amountMax}
                    boundsMin={amountBounds.min}
                    boundsMax={amountBounds.max}
                    onApply={handleAmountFilterApply}
                    onClose={() => setAmountFilterAnchor(null)}
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