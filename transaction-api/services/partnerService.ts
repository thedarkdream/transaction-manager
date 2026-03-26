import { RequestHandler } from 'express';
import { prisma } from '../db';

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

interface AssignCategoryBody {
    partnerIds: number[];
    categoryId: number | null;
}

// GET /partners — lightweight list for filter picker
const fetchPartners: RequestHandler<{}, PartnerPickerDto[]> = async (req, res) => {
    try {
        const partners = await prisma.partners.findMany({
            select: { id: true, name: true, iban: true },
            orderBy: [{ name: 'asc' }, { iban: 'asc' }]
        });
        res.send(partners);
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// GET /partners/all — full details including assigned category
export const fetchAllPartners: RequestHandler<{}, PartnerDetailDto[]> = async (req, res) => {
    try {
        const partners = await prisma.partners.findMany({
            select: {
                id: true,
                name: true,
                iban: true,
                bic: true,
                number: true,
                bank_code: true,
                country_code: true,
                address: true,
                originator: true,
                category: { select: { id: true, name: true, color: true } }
            },
            orderBy: [{ name: 'asc' }, { iban: 'asc' }]
        });
        res.send(partners);
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// POST /partners/assign-category
export const assignCategory: RequestHandler<{}, { updated: number }, AssignCategoryBody> = async (req, res) => {
    const { partnerIds, categoryId } = req.body;
    if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
        res.status(400).send('partnerIds must be a non-empty array' as any);
        return;
    }
    // null from the UI means "reset to Others"
    const effectiveCategoryId = categoryId ?? 1;
    try {
        await prisma.partners.updateMany({
            where: { id: { in: partnerIds } },
            data: { category_id: effectiveCategoryId }
        });

        // Propagate to transactions that still have Others (id=1) or NULL as their category.
        // Two separate calls to avoid Prisma OR quirks in updateMany.
        // Transactions already assigned a non-Others category are left in place.
        await prisma.transactions.updateMany({
            where: { partner_id: { in: partnerIds }, category_id: null },
            data: { category_id: effectiveCategoryId }
        });
        await prisma.transactions.updateMany({
            where: { partner_id: { in: partnerIds }, category_id: 1 },
            data: { category_id: effectiveCategoryId }
        });

        // Count total updated partners for consistency
        const updated = partnerIds.length;
        res.send({ updated });
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

export default fetchPartners;

