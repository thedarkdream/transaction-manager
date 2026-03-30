import { RequestHandler } from 'express';
import { prisma } from '../db';
import {
    AssignTransactionCategoryBody,
    MonthlyTotalDto,
    MonthlyTotalsQueryParams,
    TransactionPagedResult,
    TransactionDto,
    TransactionQueryParams,
    TransactionSortBy,
    SortDir
} from '../types/transaction';

export const fetchTransactions: RequestHandler<
    {},                           // Params
    TransactionPagedResult,        // ResBody
    {},                           // ReqBody
    TransactionQueryParams        // ReqQuery
> = async (req, res) => {
    const date_from = new Date(req.query.date_from || '1970-01-01');
    const date_to = new Date(req.query.date_to || new Date().toISOString());
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '50', 10)));

    const partnerIds = req.query.partnerIds
        ? req.query.partnerIds.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
        : null;

    const amount_min = req.query.amount_min !== undefined && req.query.amount_min !== '' ? parseFloat(req.query.amount_min) : null;
    const amount_max = req.query.amount_max !== undefined && req.query.amount_max !== '' ? parseFloat(req.query.amount_max) : null;

    const sortBy: TransactionSortBy = (['partner', 'amount', 'date', 'category'].includes(req.query.sort_by as string)
        ? req.query.sort_by
        : 'date') as TransactionSortBy;
    const sortDir: SortDir = req.query.sort_dir === 'asc' ? 'asc' : 'desc';

    const dateFallback = { booking_date: 'desc' as const };
    const idFallback   = { id: 'asc' as const };

    const orderBy =
        sortBy === 'partner'  ? [{ partner:  { name: sortDir } }, dateFallback, idFallback] :
        sortBy === 'amount'   ? [{ amount: sortDir },           dateFallback, idFallback] :
        sortBy === 'category' ? [{ category: { name: sortDir } }, dateFallback, idFallback] :
        /* date */              [{ booking_date: sortDir },      idFallback];

    const where = {
        booking_date: { gte: date_from, lte: date_to },
        ...(partnerIds && partnerIds.length > 0 ? { partner_id: { in: partnerIds } } : {}),
        ...((amount_min !== null || amount_max !== null) ? {
            amount: {
                ...(amount_min !== null ? { gte: amount_min } : {}),
                ...(amount_max !== null ? { lte: amount_max } : {})
            }
        } : {})
    };

    try {
        const [total, transactions, spentAgg, incomingAgg] = await Promise.all([
            prisma.transactions.count({ where }),
            prisma.transactions.findMany({
                where,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    owner: true,
                    partner: true,
                    category: { select: { id: true, name: true, color: true } }
                }
            }),
            prisma.transactions.aggregate({ where: { ...where, amount: { lt: 0 } }, _sum: { amount: true } }),
            prisma.transactions.aggregate({ where: { ...where, amount: { gt: 0 } }, _sum: { amount: true } }),
        ]);

        const totalSpent = parseFloat(spentAgg._sum.amount?.toString() ?? '0');
        const totalIncoming = parseFloat(incomingAgg._sum.amount?.toString() ?? '0');

        const data = transactions.map(t => ({
            id: t.id,
            owner: t.owner,
            partner: t.partner,
            category: t.category,
            reference_number: t.reference_number,
            description: t.description,
            amount: t.amount?.toString() ?? null,
            currency: t.currency,
            booking_date: t.booking_date,
            validation_date: t.validation_date
        }));

        res.send({ data, total, page, pageSize, totalSpent, totalIncoming });
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error executing query', error);
        res.status(500).send(error.message as any);
    }
};

// POST /transactions/assign-category
// Manually assign (or clear) a category on specific transactions.
export const assignTransactionCategory: RequestHandler<{}, { updated: number }, AssignTransactionCategoryBody> = async (req, res) => {
    const { transactionIds, categoryId } = req.body;
    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        res.status(400).send('transactionIds must be a non-empty array' as any);
        return;
    }
    // null from the UI means "reset to Others"
    const effectiveCategoryId = categoryId ?? 1;
    try {
        const result = await prisma.transactions.updateMany({
            where: { id: { in: transactionIds } },
            data: { category_id: effectiveCategoryId }
        });
        res.send({ updated: result.count });
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// POST /transactions/backfill-categories
// Set category_id on every transaction that has none but whose partner has one.
export const backfillTransactionCategories: RequestHandler<{}, { updated: number }> = async (req, res) => {
    try {
        // Transactions with a partner: inherit partner's category or fall back to Others
        const withPartner = await prisma.$executeRaw`
            UPDATE transactions t
            SET    category_id = COALESCE(p.category_id, 1)
            FROM   partners p
            WHERE  t.partner_id  = p.id
              AND  t.category_id IS NULL
        `;
        // Transactions with no partner at all default to Others
        const withoutPartner = await prisma.$executeRaw`
            UPDATE transactions
            SET    category_id = 1
            WHERE  category_id IS NULL
        `;
        res.send({ updated: withPartner + withoutPartner });
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// GET /transactions/amount-bounds
// Returns the global min and max transaction amounts (for the range slider).
export const fetchAmountBounds: RequestHandler<{}, { min: number; max: number }> = async (_req, res) => {
    try {
        const agg = await prisma.transactions.aggregate({
            _min: { amount: true },
            _max: { amount: true },
        });
        const min = parseFloat(agg._min.amount?.toString() ?? '0');
        const max = parseFloat(agg._max.amount?.toString() ?? '0');
        res.send({ min, max });
    } catch (err: unknown) {
        res.status(500).send((err as Error).message as any);
    }
};

// GET /transactions/monthly-totals
// Returns outgoing (negative) transactions aggregated by month + category_id.
export const fetchMonthlyTotals: RequestHandler<
    {},
    MonthlyTotalDto[],
    {},
    MonthlyTotalsQueryParams
> = async (req, res) => {
    const fromDate = new Date(req.query.date_from || '1970-01-01');
    const toDate = new Date(req.query.date_to || new Date().toISOString());

    type RawRow = { month: string; category_id: number | null; total: unknown };

    try {
        const rows = await prisma.$queryRaw<RawRow[]>`
            SELECT
                TO_CHAR(DATE_TRUNC('month', booking_date), 'YYYY-MM') AS month,
                category_id,
                CAST(SUM(ABS(amount)) AS FLOAT8) AS total
            FROM transactions
            WHERE amount < 0
              AND booking_date IS NOT NULL
              AND booking_date >= ${fromDate}
              AND booking_date <= ${toDate}
            GROUP BY 1, 2
            ORDER BY 1
        `;

        const data: MonthlyTotalDto[] = rows.map(r => ({
            month: r.month,
            categoryId: r.category_id,
            total: Number(r.total),
        }));

        res.send(data);
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Error fetching monthly totals', error);
        res.status(500).send(error.message as any);
    }
};
