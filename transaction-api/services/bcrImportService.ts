import { prisma } from '../db';
import { BcrTransaction } from '../types/bcr/BcrTransaction';

export interface ImportResult {
    imported: number;
    skipped: number;
}

async function findOrCreateOwner(t: BcrTransaction): Promise<number | null> {
    if (!t.ownerAccountNumber && !t.ownerAccountTitle) return null;

    const existing = await prisma.owners.findFirst({
        where: { account_number: t.ownerAccountNumber }
    });
    if (existing) return existing.id;

    const created = await prisma.owners.create({
        data: {
            account_number: t.ownerAccountNumber,
            account_title: t.ownerAccountTitle,
            originator: t.ownerOriginator
        }
    });
    return created.id;
}

async function findOrCreatePartner(t: BcrTransaction): Promise<number | null> {
    if (!t.partnerName && !t.partnerAccount?.iban) return null;

    const existing = t.partnerAccount?.iban
        ? await prisma.partners.findFirst({ where: { iban: t.partnerAccount.iban } })
        : await prisma.partners.findFirst({ where: { name: t.partnerName } });

    if (existing) return existing.id;

    const created = await prisma.partners.create({
        data: {
            name: t.partnerName,
            iban: t.partnerAccount?.iban ?? null,
            bic: t.partnerAccount?.bic ?? null,
            number: t.partnerAccount?.number ?? null,
            bank_code: t.partnerAccount?.bankCode ?? null,
            country_code: t.partnerAccount?.countryCode ?? null,
            prefix: t.partnerAccount?.prefix ?? null,
            secondary_id: t.partnerAccount?.secondaryId ?? null,
            address: t.partnerAddress,
            originator: t.partnerOriginator,
            category_id: 1  // Default to "Others"
        }
    });
    return created.id;
}

export async function importBcrTransactions(transactions: BcrTransaction[]): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;

    for (const t of transactions) {
        try {
            const owner_id = await findOrCreateOwner(t);
            const partner_id = await findOrCreatePartner(t);

            // Inherit category from partner (always at least "Others" = 1)
            let category_id: number = 1;
            if (partner_id !== null) {
                const partner = await prisma.partners.findUnique({
                    where: { id: partner_id },
                    select: { category_id: true }
                });
                category_id = partner?.category_id ?? 1;
            }

            await prisma.transactions.create({
                data: {
                    owner_id,
                    partner_id,
                    category_id,
                    reference_number: t.referenceNumber,
                    description: t.reference,
                    amount: t.amount ? t.amount.value / 10 ** t.amount.precision : null,
                    currency: t.amount?.currency ?? null,
                    booking_date: t.booking ? new Date(t.booking) : null,
                    validation_date: t.valuation ? new Date(t.valuation) : null
                }
            });
            imported++;
        } catch {
            skipped++;
        }
    }

    return { imported, skipped };
}
