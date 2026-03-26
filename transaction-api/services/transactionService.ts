import { RequestHandler } from 'express';
import { prisma } from '../db';
import {
    AssignTransactionCategoryBody,
    PagedResult,
    TransactionDto,
    TransactionQueryParams
} from '../types/transaction';

const fetchTransactions: RequestHandler<
    {},                          // Params
    PagedResult<TransactionDto>, // ResBody
    {},                          // ReqBody
    TransactionQueryParams       // ReqQuery
> = async (req, res) => {
    const date_from = new Date(req.query.date_from || '1970-01-01');
    const date_to = new Date(req.query.date_to || new Date().toISOString());
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize || '50', 10)));

    const partnerIds = req.query.partnerIds
        ? req.query.partnerIds.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
        : null;

    const where = {
        booking_date: { gte: date_from, lte: date_to },
        ...(partnerIds && partnerIds.length > 0 ? { partner_id: { in: partnerIds } } : {})
    };

    try {
        const [total, transactions] = await Promise.all([
            prisma.transactions.count({ where }),
            prisma.transactions.findMany({
                where,
                orderBy: { booking_date: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    owner: true,
                    partner: true,
                    category: { select: { id: true, name: true, color: true } }
                }
            })
        ]);

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

        res.send({ data, total, page, pageSize });
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

export default fetchTransactions;
