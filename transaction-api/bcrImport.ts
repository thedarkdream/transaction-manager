import * as fs from 'fs';
import { BcrTransaction } from './types/bcr/BcrTransaction';
import { importBcrTransactions } from './services/bcrImportService';
import { prisma } from './db';

const filename = process.argv[2];
if (!filename) {
    console.error('Usage: tsx bcrImport.ts <filename>');
    process.exit(1);
}

async function main(): Promise<void> {
    const data = fs.readFileSync(filename, 'utf-8');
    const transactions = JSON.parse(data) as BcrTransaction[];

    console.log(`Importing ${transactions.length} transactions from ${filename}...`);
    const result = await importBcrTransactions(transactions);
    console.log(`Done. Imported: ${result.imported}, Skipped: ${result.skipped}`);

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
