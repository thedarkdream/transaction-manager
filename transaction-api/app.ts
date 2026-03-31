import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { fetchTransactions, assignTransactionCategory, backfillTransactionCategories, fetchMonthlyTotals, fetchAmountBounds } from './services/transactionService';
import { fetchCategories, addCategory, updateCategory, moveCategory, deleteCategory } from './services/categoryService';
import { bcrImportUpload, bcrImportHandler } from './services/bcrImportService';
import { revolutImportUpload, revolutImportHandler } from './services/revolutImportService';
import { fetchPartners, fetchAllPartners, assignCategory } from './services/partnerService';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

const port = 5000;

app.get('/transactions/monthly-totals', fetchMonthlyTotals);
app.get('/transactions/amount-bounds', fetchAmountBounds);
app.get('/transactions', fetchTransactions);
app.post('/transactions/assign-category', assignTransactionCategory);
app.post('/transactions/backfill-categories', backfillTransactionCategories);
app.get('/partners', fetchPartners);
app.get('/partners/all', fetchAllPartners);
app.post('/partners/assign-category', assignCategory);

app.get('/categories', fetchCategories);
app.post('/categories', addCategory);
app.put('/categories/:id', updateCategory);
app.post('/categories/move', moveCategory);
app.delete('/categories/:id', deleteCategory);

app.post('/import/bcr', bcrImportUpload, bcrImportHandler);
app.post('/import/revolut', revolutImportUpload, revolutImportHandler);

app.get('/import/reports/:filename', (req, res) => {
    // Guard against path traversal — only allow plain filenames
    const filename = path.basename(req.params.filename);
    const filePath = path.resolve(__dirname, 'data', 'reports', filename);
    if (!filename.endsWith('.csv')) {
        res.status(400).send('Invalid report filename');
        return;
    }
    res.download(filePath, filename, (err) => {
        if (err) res.status(404).send('Report not found');
    });
});

app.get('/owners', async (_req, res) => {
    const owners = await prisma.owners.findMany({
        orderBy: { account_title: 'asc' },
    });
    res.json(owners);
});

app.listen(port, () => {
    console.log('Server Listening on PORT:', port);
});
