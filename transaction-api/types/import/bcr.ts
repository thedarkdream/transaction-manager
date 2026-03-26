export interface BcrAmount {
    value: number;
    precision: number;
    currency: string;
}

export interface BcrAccount {
    iban: string | null;
    bic: string | null;
    number: string | null;
    bankCode: string | null;
    countryCode: string | null;
    prefix: string | null;
    secondaryId: string | null;
}


export interface BcrStructuredAddress {
    [key: string]: unknown;
}

export interface BcrTransaction {
    transactionId: string | null;
    containedTransactionId: string | null;
    booking: string | null;
    valuation: string | null;
    transactionDateTime: string | null;

    // Partner
    partnerName: string | null;
    partnerAccount: BcrAccount | null;
    partnerAddress: string | null;
    partnerStructuredAddress: BcrStructuredAddress | null;
    partnerReference: string | null;
    partnerOriginator: string | null;

    // Amounts
    amount: BcrAmount | null;
    amountSender: BcrAmount | null;
    balance: BcrAmount | null;
    exchangeRateValue: number | null;
    foreignExchangeFee: BcrAmount | null;
    transactionFee: BcrAmount | null;

    // Reference
    reference: string | null;
    referenceNumber: string | null;
    note: string | null;
    e2eReference: string | null;
    instructionName: string | null;
    loanReference: string | null;

    // Metadata
    categories: unknown | null;
    favorite: boolean;
    bookingTypeTranslation: string | null;
    paymentMethod: string | null;

    // Symbols (used in some Eastern European banking systems)
    constantSymbol: string | null;
    variableSymbol: string | null;
    specificSymbol: string | null;

    // Receiver
    receiverReference: string | null;
    receiverAddress: string | null;
    receiverStructuredAddress: BcrStructuredAddress | null;
    receiverIdentificationReference: string | null;
    receiverName: string | null;
    receiverModeReference: string | null;

    // Sender
    senderReference: string | null;
    senderAddress: string | null;
    senderIdentificationReference: string | null;
    senderModeReference: string | null;
    senderOriginator: string | null;

    // Card
    cardNumber: string | null;
    cardLocation: string | null;
    cardType: string | null;
    cardBrand: string | null;
    virtualCardNumber: string | null;
    virtualCardDeviceName: string | null;
    virtualCardMobilePaymentApplicationName: string | null;
    pinEntry: string | null;

    // SEPA
    sepaMandateId: string | null;
    sepaCreditorId: string | null;
    sepaPurposeType: string | null;
    sepaScheme: string | null;

    // Owner
    ownerOriginator: string | null;
    ownerAccountNumber: string | null;
    ownerAccountTitle: string | null;

    // Ultimate parties
    ultimateCreditor: string | null;
    ultimateCreditorStructuredAddress: BcrStructuredAddress | null;
    ultimateDebtor: string | null;
    ultimateDebtorStructuredAddress: BcrStructuredAddress | null;

    // Misc
    investmentInstrumentName: string | null;
    aliasPay: string | null;
    merchantName: string | null;
}