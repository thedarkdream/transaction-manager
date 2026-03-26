import React from 'react';

interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
}

function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;

    // Show a window of up to 5 page numbers centred around the current page
    const windowSize = 5;
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) {
        start = Math.max(1, end - windowSize + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);

    return (
        <div className="pagination">
            <button
                className="btn btn-page"
                disabled={page === 1}
                onClick={() => onPageChange(page - 1)}
            >‹</button>

            {start > 1 && (
                <>
                    <button className="btn btn-page" onClick={() => onPageChange(1)}>1</button>
                    {start > 2 && <span className="pagination-ellipsis">…</span>}
                </>
            )}

            {pages.map(p => (
                <button
                    key={p}
                    className={`btn btn-page${p === page ? ' btn-page-active' : ''}`}
                    onClick={() => onPageChange(p)}
                >
                    {p}
                </button>
            ))}

            {end < totalPages && (
                <>
                    {end < totalPages - 1 && <span className="pagination-ellipsis">…</span>}
                    <button className="btn btn-page" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
                </>
            )}

            <button
                className="btn btn-page"
                disabled={page === totalPages}
                onClick={() => onPageChange(page + 1)}
            >›</button>

            <span className="pagination-info">
                Page {page} of {totalPages} &nbsp;·&nbsp; {total} transactions
            </span>
        </div>
    );
}

export default Pagination;
