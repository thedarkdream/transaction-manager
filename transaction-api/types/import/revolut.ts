/** Raw row as parsed from the Revolut CSV export. */
export interface RevolutCsvRow {
    Type: string;
    Product: string;
    'Started Date': string;
    'Completed Date': string;
    Description: string;
    Amount: string;
    Fee: string;
    Currency: string;
    State: string;
    Balance: string;
}

/** Transaction types present in Revolut exports. */
export type RevolutType =
    | 'Card Payment'
    | 'Card Refund'
    | 'Transfer'
    | 'Topup'
    | 'ATM'
    | 'Exchange'
    | 'Fee'
    | 'Rev Payment'
    | 'CASHBACK'
    | 'TEMP_BLOCK';
