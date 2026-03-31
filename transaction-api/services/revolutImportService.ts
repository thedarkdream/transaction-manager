import { RequestHandler } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../db';
import { RevolutCsvRow } from '../types/import/revolut';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RevolutImportResult {
    imported: number;
    skipped: number;
    /** Server-side filename of the generated skip report (if any rows were skipped). */
    reportFile: string | null;
}

interface ReportEntry {
    row: number;           // 1-based CSV data row (header = row 1, first data row = row 2)
    type: string;
    startedDate: string;
    completedDate: string;
    description: string;
    amount: string;
    fee: string;
    currency: string;
    state: string;
    skipReason: string;
}

// ── Report helpers ────────────────────────────────────────────────────────────

const REPORTS_DIR = path.resolve(__dirname, '..', 'data', 'reports');

function ensureReportsDir(): void {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
}

/** Escapes a single CSV field value (double-quotes any value containing commas, quotes or newlines). */
function csvField(value: string | number): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function buildReportCsv(entries: ReportEntry[]): string {
    const header = [
        'Row #',
        'Type',
        'Started Date',
        'Completed Date',
        'Description',
        'Amount',
        'Fee',
        'Currency',
        'State',
        'Skip Reason',
    ].join(',');

    const dataRows = entries.map(e =>
        [
            e.row,
            e.type,
            e.startedDate,
            e.completedDate,
            e.description,
            e.amount,
            e.fee,
            e.currency,
            e.state,
            e.skipReason,
        ]
            .map(csvField)
            .join(','),
    );

    return [header, ...dataRows].join('\r\n') + '\r\n';
}

function writeReport(entries: ReportEntry[]): string {
    ensureReportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `revolut_import_${timestamp}.csv`;
    fs.writeFileSync(path.join(REPORTS_DIR, filename), buildReportCsv(entries), 'utf-8');
    return filename;
}

// ── Description prefix stripping ─────────────────────────────────────────────

const DESCRIPTION_PREFIXES = [
    'Transfer from ',
    'Transfer to ',
    'Top-up by ',
    'From ',
    'To ',
];

/**
 * Strips known Revolut action prefixes from a description to extract the
 * partner name.  E.g. "Transfer to Diana Vijulie" → "Diana Vijulie".
 */
function extractPartnerName(description: string): string {
    const trimmed = description.trim();
    for (const prefix of DESCRIPTION_PREFIXES) {
        if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
            return trimmed.slice(prefix.length).trim();
        }
    }
    return trimmed;
}

// ── Owner ─────────────────────────────────────────────────────────────────────

async function resolveOwner(ownerId: number): Promise<number | null> {
    const owner = await prisma.owners.findUnique({ where: { id: ownerId } });
    return owner ? owner.id : null;
}

// ── Partner ───────────────────────────────────────────────────────────────────

async function findOrCreatePartner(partnerName: string): Promise<number> {
    const existing = await prisma.partners.findFirst({
        where: { name: partnerName },
    });
    if (existing) return existing.id;

    const created = await prisma.partners.create({
        data: {
            name: partnerName,
            iban: null,
            bic: null,
            number: null,
            bank_code: null,
            country_code: null,
            prefix: null,
            secondary_id: null,
            address: null,
            originator: 'Revolut',
            category_id: 1, // default "Others"
        },
    });
    return created.id;
}

// ── Duplicate detection ───────────────────────────────────────────────────────

async function isDuplicate(
    bookingDate: Date,
    amount: number,
    currency: string,
    partnerId: number,
): Promise<boolean> {
    const existing = await prisma.transactions.findFirst({
        where: {
            booking_date: bookingDate,
            amount: amount,
            currency: currency,
            partner_id: partnerId,
        },
    });
    return existing !== null;
}

// ── Core import logic ─────────────────────────────────────────────────────────

export async function importRevolutTransactions(
    rows: RevolutCsvRow[],
    ownerId: number,
    importReverted: boolean,
): Promise<RevolutImportResult> {
    let imported = 0;
    let skipped = 0;
    const reportEntries: ReportEntry[] = [];

    // Validate that the owner exists
    const resolvedOwnerId = await resolveOwner(ownerId);
    if (resolvedOwnerId === null) {
        throw new Error(`Owner with id ${ownerId} not found`);
    }

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // CSV row number: header is row 1, first data row is row 2
        const csvRowNumber = i + 2;

        const reportContext: Omit<ReportEntry, 'skipReason'> = {
            row: csvRowNumber,
            type: row.Type ?? '',
            startedDate: row['Started Date'] ?? '',
            completedDate: row['Completed Date'] ?? '',
            description: row.Description ?? '',
            amount: row.Amount ?? '',
            fee: row.Fee ?? '',
            currency: row.Currency ?? '',
            state: row.State ?? '',
        };

        try {
            // Skip TEMP_BLOCK
            if (row.Type === 'TEMP_BLOCK') {
                skipped++;
                reportEntries.push({ ...reportContext, skipReason: 'Skipped: TEMP_BLOCK transaction type' });
                continue;
            }

            // State filtering
            if (row.State === 'REVERTED' && !importReverted) {
                skipped++;
                reportEntries.push({ ...reportContext, skipReason: 'Skipped: REVERTED state (import reverted rows is disabled)' });
                continue;
            }

            const amount = parseFloat(row.Amount);
            const fee = parseFloat(row.Fee);
            const currency = row.Currency.trim();
            const bookingDate = parseRevolutDate(row['Started Date']);
            const validationDate = row['Completed Date']?.trim()
                ? parseRevolutDate(row['Completed Date'])
                : null;

            const description = row.Description.trim();
            const partnerName = extractPartnerName(description);
            const compositeDescription = `${row.Type.trim()}: ${description}`;

            // Resolve partner
            const partnerId = await findOrCreatePartner(partnerName);

            // Inherit category from partner
            const partner = await prisma.partners.findUnique({
                where: { id: partnerId },
                select: { category_id: true },
            });
            const categoryId = partner?.category_id ?? 1;

            // Duplicate check
            if (await isDuplicate(bookingDate, amount, currency, partnerId)) {
                skipped++;
                reportEntries.push({
                    ...reportContext,
                    skipReason: `Duplicate: transaction already exists with booking_date=${bookingDate.toISOString()}, amount=${amount}, currency=${currency}, partner="${partnerName}"`,
                });
                continue;
            }

            // Create main transaction
            await prisma.transactions.create({
                data: {
                    owner_id: resolvedOwnerId,
                    partner_id: partnerId,
                    category_id: categoryId,
                    reference_number: null,
                    description: compositeDescription,
                    amount: amount,
                    currency: currency,
                    booking_date: bookingDate,
                    validation_date: validationDate,
                },
            });
            imported++;

            // Create fee transaction when fee is non-zero
            if (!isNaN(fee) && fee !== 0) {
                await prisma.transactions.create({
                    data: {
                        owner_id: resolvedOwnerId,
                        partner_id: partnerId,
                        category_id: categoryId,
                        reference_number: null,
                        description: `Fee: ${description}`,
                        amount: -Math.abs(fee),
                        currency: currency,
                        booking_date: bookingDate,
                        validation_date: validationDate,
                    },
                });
                imported++;
            }
        } catch (err: unknown) {
            skipped++;
            const reason = err instanceof Error ? err.message : String(err);
            reportEntries.push({ ...reportContext, skipReason: `Error: ${reason}` });
        }
    }

    // Write report only when there are skipped rows
    const reportFile = reportEntries.length > 0 ? writeReport(reportEntries) : null;

    return { imported, skipped, reportFile };
}

// ── Date parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a Revolut date string ("YYYY-MM-DD H:mm:ss" or "YYYY-MM-DD HH:mm:ss") as UTC.
 * Revolut exports sometimes use a single-digit hour (e.g. "2019-03-06 2:30:34"),
 * which is not valid ISO 8601 — we zero-pad the hour before parsing.
 */
function parseRevolutDate(value: string): Date {
    // Pad single-digit hour: "YYYY-MM-DD H:mm:ss" → "YYYY-MM-DD HH:mm:ss"
    const normalised = value.trim().replace(
        /^(\d{4}-\d{2}-\d{2}) (\d):(\d{2}:\d{2})$/,
        '$1 0$2:$3',
    );
    return new Date(normalised.replace(' ', 'T') + 'Z');
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage() });

export const revolutImportUpload = upload.single('file');

export const revolutImportHandler: RequestHandler<{}, RevolutImportResult | string> = async (
    req,
    res,
) => {
    if (!req.file) {
        res.status(400).send('No file uploaded' as any);
        return;
    }

    const ownerIdRaw = req.body?.ownerId;
    const ownerId = parseInt(ownerIdRaw, 10);
    if (isNaN(ownerId)) {
        res.status(400).send('Missing or invalid ownerId' as any);
        return;
    }

    const importReverted = req.body?.importReverted === 'true';

    let rows: RevolutCsvRow[];
    try {
        rows = parse(req.file.buffer.toString('utf-8'), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        }) as RevolutCsvRow[];
    } catch {
        res.status(400).send('Invalid or malformed CSV file' as any);
        return;
    }

    try {
        const result = await importRevolutTransactions(rows, ownerId, importReverted);
        res.send(result);
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Revolut import error', error);
        res.status(500).send(error.message as any);
    }
};
