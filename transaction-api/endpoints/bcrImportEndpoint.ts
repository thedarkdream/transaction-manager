import { RequestHandler } from 'express';
import multer from 'multer';
import { BcrTransaction } from '../types/bcr/BcrTransaction';
import { importBcrTransactions, ImportResult } from '../services/bcrImportService';

const upload = multer({ storage: multer.memoryStorage() });

export const bcrImportUpload = upload.single('file');

export const bcrImportHandler: RequestHandler<{}, ImportResult> = async (req, res) => {
    if (!req.file) {
        res.status(400).send('No file uploaded' as any);
        return;
    }

    let transactions: BcrTransaction[];
    try {
        transactions = JSON.parse(req.file.buffer.toString('utf-8')) as BcrTransaction[];
    } catch {
        res.status(400).send('Invalid JSON' as any);
        return;
    }

    try {
        const result = await importBcrTransactions(transactions);
        res.send(result);
    } catch (err: unknown) {
        const error = err as Error;
        console.error('Import error', error);
        res.status(500).send(error.message as any);
    }
};
