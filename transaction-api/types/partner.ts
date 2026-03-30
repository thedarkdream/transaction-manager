// Minimal DTO used by the transaction filter popup
export interface PartnerPickerDto {
    id: number;
    name: string | null;
    iban: string | null;
}

// Full DTO used by the Partners management page
export interface PartnerDetailDto {
    id: number;
    name: string | null;
    iban: string | null;
    bic: string | null;
    number: string | null;
    bank_code: string | null;
    country_code: string | null;
    address: string | null;
    originator: string | null;
    category: { id: number; name: string | null } | null;
}

export interface AssignPartnerCategoryBody {
    partnerIds: number[];
    categoryId: number | null;
}
