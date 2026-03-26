import { prisma } from './db';
import * as fs from 'fs';
import { BcrTransaction } from './types/bcr/BcrTransaction';

const filename = process.argv[2];
if (!filename) {
    console.error('Usage: tsx import.ts <filename>');
    process.exit(1);
}

async function main(): Promise<void> {
    const transactions: BcrTransaction[] = readFile(filename);
    let index = 0;

    for (const transaction of transactions) {
        console.log('processing transaction ' + ++index + '/' + transactions.length);
        await handleTransaction(transaction);
    }

    console.log('Done.');
    await prisma.$disconnect();
}

function readFile(path: string): BcrTransaction[] {
    const data = fs.readFileSync(path, 'utf-8');
    return JSON.parse(data) as BcrTransaction[];
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
            originator: t.partnerOriginator
        }
    });
    return created.id;
}

async function handleTransaction(t: BcrTransaction): Promise<void> {
    const owner_id = await findOrCreateOwner(t);
    const partner_id = await findOrCreatePartner(t);

    await prisma.transactions.create({
        data: {
            owner_id,
            partner_id,
            reference_number: t.referenceNumber,
            description: t.reference,
            amount: t.amount ? t.amount.value / 10 ** t.amount.precision : null,
            currency: t.amount?.currency ?? null,
            booking_date: t.booking ? new Date(t.booking) : null,
            validation_date: t.valuation ? new Date(t.valuation) : null
        }
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
