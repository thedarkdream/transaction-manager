import React, { useRef } from 'react';
import { TransactionDto } from '../ApiModel';

interface TransactionProps {
    entries?: Array<TransactionDto>;
    selectedPartnerIds?: number[];
    onOpenPartnerFilter?: (anchor: DOMRect) => void;
    dateFrom?: string;
    dateTo?: string;
    onOpenDateFilter?: (anchor: DOMRect) => void;
    selectedIds?: Set<number>;
    onToggle?: (id: number) => void;
    onToggleAll?: () => void;
}

function FilterIcon() {
    return (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M1 2h10L7.5 6v3.5l-3-1.5V6L1 2z" />
        </svg>
    );
}

function Transactions({ entries, selectedPartnerIds = [], onOpenPartnerFilter, dateFrom, dateTo, onOpenDateFilter, selectedIds, onToggle, onToggleAll }: TransactionProps) {
    const filterBtnRef = useRef<HTMLButtonElement>(null);
    const dateFilterBtnRef = useRef<HTMLButtonElement>(null);
    const selectable = !!onToggle;

    function handleFilterClick() {
        if (filterBtnRef.current && onOpenPartnerFilter) {
            onOpenPartnerFilter(filterBtnRef.current.getBoundingClientRect());
        }
    }

    function handleDateFilterClick() {
        if (dateFilterBtnRef.current && onOpenDateFilter) {
            onOpenDateFilter(dateFilterBtnRef.current.getBoundingClientRect());
        }
    }

    if (!entries) {
        return <p className="empty-msg">No transactions.</p>;
    }

    const allSelected = entries.length > 0 && entries.every(e => selectedIds?.has(e.id));
    const someSelected = entries.some(e => selectedIds?.has(e.id));

    return (
        <table className="transactions-table">
            <thead>
                <tr>
                    {selectable && (
                        <th className="col-check">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                onChange={onToggleAll}
                                title="Select all on this page"
                            />
                        </th>
                    )}
                    <th>Owner</th>
                    <th>
                        <div className="th-filter">
                            Partner
                            {onOpenPartnerFilter && (
                                <button
                                    ref={filterBtnRef}
                                    className={`btn-th-filter${selectedPartnerIds.length > 0 ? ' btn-th-filter-active' : ''}`}
                                    onClick={handleFilterClick}
                                    title="Filter by partner"
                                >
                                    <FilterIcon />
                                    {selectedPartnerIds.length > 0 && (
                                        <span className="btn-th-filter-badge">{selectedPartnerIds.length}</span>
                                    )}
                                </button>
                            )}
                        </div>
                    </th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>
                        <div className="th-filter">
                            Date
                            {onOpenDateFilter && (
                                <button
                                    ref={dateFilterBtnRef}
                                    className={`btn-th-filter${(dateFrom || dateTo) ? ' btn-th-filter-active' : ''}`}
                                    onClick={handleDateFilterClick}
                                    title="Filter by date"
                                >
                                    <FilterIcon />
                                </button>
                            )}
                        </div>
                    </th>
                    <th>Category</th>
                </tr>
            </thead>
            <tbody>
                {entries.map((entry) => {
                    const isSelected = selectedIds?.has(entry.id) ?? false;
                    return (
                        <tr
                            key={entry.id}
                            className={isSelected ? 'row-selected' : ''}
                            onClick={() => onToggle?.(entry.id)}
                            style={selectable ? { cursor: 'pointer' } : undefined}
                        >
                            {selectable && (
                                <td className="col-check" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onToggle?.(entry.id)}
                                    />
                                </td>
                            )}
                            <td>{entry.owner?.account_title ?? entry.owner?.account_number ?? '—'}</td>
                            <td>{entry.partner?.name ?? entry.partner?.iban ?? '—'}</td>
                            <td className="col-amount">{entry.amount} {entry.currency}</td>
                            <td className="col-description">{entry.description}</td>
                            <td className="col-date">{entry.booking_date ? new Date(entry.booking_date).toLocaleDateString() : '—'}</td>
                            <td>
                                {entry.category
                                    ? <span
                                        className="category-tag"
                                        style={{ background: entry.category.color ?? '#9ca3af' }}
                                      >{entry.category.name}</span>
                                    : <span className="no-category">—</span>
                                }
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export default Transactions;
