export type CategorySummaryDto = {
    id: number;
    name: string | null;
    color: string | null;
}

export type OwnerDto = {
    id: number;
    account_number: string | null;
    account_title: string | null;
    originator: string | null;
}

export type PartnerDto = {
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

export type TransactionDto = {
    id: number;
    owner: OwnerDto | null;
    partner: PartnerDto | null;
    category: CategorySummaryDto | null;
    reference_number: string | null;
    description: string | null;
    amount: string | null;
    currency: string | null;
    booking_date: string | null;
    validation_date: string | null;
}

export type ImportResultDto = {
    imported: number;
    skipped: number;
    /** Filename of the server-side skip report, present only when rows were skipped (Revolut import). */
    reportFile: string | null;
}

export type PartnerPickerDto = {
    id: number;
    name: string | null;
    iban: string | null;
}

export type PartnerDetailDto = {
    id: number;
    name: string | null;
    iban: string | null;
    bic: string | null;
    number: string | null;
    bank_code: string | null;
    country_code: string | null;
    address: string | null;
    originator: string | null;
    category: { id: number; name: string | null; color: string | null } | null;
}

export type PagedResult<T> = {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}

export type TransactionPagedResult = PagedResult<TransactionDto> & {
    totalSpent: number;
    totalIncoming: number;
}

export type MonthlyTotalDto = {
    month: string;          // 'YYYY-MM'
    categoryId: number | null;
    total: number;
}

export type AmountBoundsDto = {
    min: number;
    max: number;
}

export type TransactionSortBy = 'partner' | 'amount' | 'date' | 'category';
export type SortDir = 'asc' | 'desc';

export type CategoryDto = {
    id: number;
    name: string;
    parent: number | null;
    index: number;
    color: string | null;
    children: Array<CategoryDto>;
}