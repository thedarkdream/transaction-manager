import express from 'express';
import cors from 'cors';
import fetchTransactions, { assignTransactionCategory, backfillTransactionCategories, fetchMonthlyTotals } from './services/transactionService';
import { fetchCategories, addCategory, updateCategory, moveCategory, deleteCategory } from './services/categoryService';
import { bcrImportUpload, bcrImportHandler } from './endpoints/bcrImportEndpoint';
import fetchPartners, { fetchAllPartners, assignCategory } from './services/partnerService';

const app = express();
app.use(cors());
app.use(express.json());

const port = 5000;

app.get('/transactions/monthly-totals', fetchMonthlyTotals);
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

app.listen(port, () => {
    console.log('Server Listening on PORT:', port);
});
