export type TransactionSortBy = 'partner' | 'amount' | 'date' | 'category';
export type SortDir = 'asc' | 'desc';

export interface TransactionQueryParams {
    date_from?: string;
    date_to?: string;
    amount_min?: string;
    amount_max?: string;
    page?: string;
    pageSize?: string;
    partnerIds?: string;  // comma-separated partner IDs
    sort_by?: TransactionSortBy;
    sort_dir?: SortDir;
}

export interface MonthlyTotalsQueryParams {
    date_from?: string;
    date_to?: string;
}

export interface MonthlyTotalDto {
    month: string;         // 'YYYY-MM'
    categoryId: number | null;
    total: number;
}

export interface PagedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface TransactionPagedResult extends PagedResult<TransactionDto> {
    totalSpent: number;
    totalIncoming: number;
}

export interface CategorySummaryDto {
    id: number;
    name: string | null;
    color: string | null;
}

export interface OwnerDto {
    id: number;
    account_number: string | null;
    account_title: string | null;
    originator: string | null;
}

export interface PartnerDto {
    id: number;
    name: string | null;
    iban: string | null;
    bic: string | null;
    number: string | null;
    bank_code: string | null;
    country_code: string | null;
    prefix: string | null;
    secondary_id: string | null;
    address: string | null;
    originator: string | null;
}

export interface TransactionDto {
    id: number;
    owner: OwnerDto | null;
    partner: PartnerDto | null;
    category: CategorySummaryDto | null;
    reference_number: string | null;
    description: string | null;
    amount: string | null;
    currency: string | null;
    booking_date: Date | null;
    validation_date: Date | null;
}

export interface AssignTransactionCategoryBody {
    transactionIds: number[];
    categoryId: number | null;
}
