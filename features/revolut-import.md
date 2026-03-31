# Feature: Revolut CSV Import

## Overview

Allow users to import their Revolut transaction history (exported as a CSV file) into
the transaction manager. The feature should follow the same overall pattern as the
existing BCR JSON import, adding a new API endpoint and updating the UI import page.

---

## 1. Input Data Model (Revolut CSV)

The CSV file exported by Revolut has the following header and columns:

| Column         | Example value                   | Notes                                              |
|----------------|---------------------------------|----------------------------------------------------|
| `Type`         | `Card Payment`                  | Transaction type (see §4 for all known values)     |
| `Product`      | `Current`                       | Always `Current` in available data — can be ignored |
| `Started Date` | `2019-01-11 10:37:13`           | Date/time the transaction was initiated            |
| `Completed Date` | `2019-01-14 07:24:28`         | Date/time the transaction was settled; may be empty |
| `Description`  | `Kaufland`                      | Free-text — merchant name, transfer counterpart, etc. |
| `Amount`       | `-20.8`                         | Signed decimal; negative = debit, positive = credit |
| `Fee`          | `0`                             | Fee charged by Revolut (usually `0`)               |
| `Currency`     | `RON`                           | ISO currency code                                  |
| `State`        | `COMPLETED`                     | `COMPLETED` or `REVERTED`                          |
| `Balance`      | `221.2`                         | Running balance after transaction — informational  |

---

## 2. Database Field Mapping

### `transactions` table

| DB field          | Source                              | Notes                                        |
|-------------------|-------------------------------------|----------------------------------------------|
| `amount`          | `Amount`                            | Direct decimal value                         |
| `currency`        | `Currency`                          | Direct string value                          |
| `booking_date`    | `Started Date`                      | Parse as UTC datetime                        |
| `validation_date` | `Completed Date`                    | Parse as UTC datetime; nullable              |
| `description`     | `Type` + `Description`              | Suggested composite: `"<Type>: <Description>"` — open to change |
| `reference_number`| —                                   | No equivalent in CSV; set to `null`          |
| `owner_id`        | Resolved owner (see §3.1)           |                                              |
| `partner_id`      | Resolved partner (see §3.2)         |                                              |
| `category_id`     | Inherited from partner (default: `Others`) |                                        |

### `owners` table

There is no per-transaction owner data in the Revolut CSV. A single shared owner
record should represent the Revolut account. See §3.1.

### `partners` table

The `Description` field is the closest proxy for a partner/counterpart name.
Only `name` can be populated; all account-level fields (`iban`, `bic`, etc.) are
unavailable in this CSV format.

---

## 3. Business Rules

### 3.1 Owner Resolution

The import UI, on selecting revolut import, will ask the user to use an already
existing owner from the database. The purpose of this entire tool is to make statistics
on my entire family's transactions, so the payers are the same (selectable).

### 3.2 Partner Resolution

For types where a named counterpart is meaningful (`Card Payment`, `Transfer`,
`ATM`, `Exchange`, `Fee`, `Rev Payment`, `Topup`, `Card Refund`, `CASHBACK`):

1. Parse `Description` because it can contain an action + the partnet's name.
   - Descriptions can start by "Top-up by", "To", "From", "Transfer to", "Transfer from"
   - This part should be ignored when creating the partner name. "Transfer to Diana" should create/use a partner named "Diana"
2. Use the stripped part of `Description` as the partner `name`.
3. Look up an existing partner by exact name match.
4. If not found, create a new partner with:
   - `name` = processed `Description`
   - All account fields = `null`
   - `originator` = `"Revolut"`
   - `category_id` = `1` (default "Others")
5. Inherit `category_id` from the resolved partner.

Partners created via Revolut import be distinguishable from other
partners (e.g. via `originator = "Revolut"`).

### 3.3 State Filtering

| State       | Action           |
|-------------|------------------|
| `COMPLETED` | Import           |
| `REVERTED`  | **Skip** by default |

The decision whether the `REVERTED` rows should be imported should be handed to the user.
"Import reverted rows" should be an option in the import page, that will get passed to
the back-end.

### 3.4 Fee Handling

The `Fee` column represents an additional charge levied by Revolut on top of `Amount`.

When `Fee != 0`, create a second transaction record for the fee amount
with a description like `"Fee: <original Description>"`.

### 3.5 Duplicate Detection

Revolut CSV rows do not carry a unique transaction ID, so deduplication must rely on
a combination of fields.

**duplicate key:** `(booking_date, amount, currency, partner.name)`

If a transaction already exists with the same tuple, skip it and increment the
`skipped` counter.


### 3.6 Transaction Type Notes

| Type           | Partner source          | Typical sign | Notes                           |
|----------------|-------------------------|--------------|----------------------------------|
| `Card Payment` | `Description` (merchant)| negative     | Standard POS purchase            |
| `Card Refund`  | `Description` (merchant)| positive     | Reversal of a card payment       |
| `Transfer`     | `Description` (person)  | either       | P2P Revolut transfer             |
| `Topup`        | `Description` (card ref)| positive     | Funds loaded from a bank card    |
| `ATM`          | `Description`           | negative     | Cash withdrawal                  |
| `Exchange`     | `Description`           | negative     | Currency exchange (RON debited)  |
| `Fee`          | `Description`           | negative     | Revolut service fee              |
| `Rev Payment`  | `Description`           | either       | Revolut Pay / request payment    |
| `CASHBACK`     | `Description`           | positive     | Cashback reward credit           |
| `TEMP_BLOCK`   | —                       | —            | Temporary block (pending) — **skip** or treat as REVERTED |

---

## 4. API Endpoint

**`POST /import/revolut`**

- **Content-Type:** `multipart/form-data`
- **Field name:** `file`
- **File format:** CSV (UTF-8, comma-separated, first row is header)
- **Response (200 OK):**
  ```json
  { "imported": 42, "skipped": 3 }
  ```
- **Error responses:** `400` for missing/malformed file, `500` for unexpected errors.

### Implementation files (following BCR pattern)

| New file                                          | Purpose                          |
|---------------------------------------------------|----------------------------------|
| `types/import/revolut.ts`                         | `RevolutCsvRow` interface        |
| `services/revolutImportService.ts`                | CSV parsing + DB import logic    |

Register handler in `app.ts`:
```typescript
app.post('/import/revolut', revolutImportUpload, revolutImportHandler);
```

---

## 5. CSV Parsing

Use a CSV parsing library (e.g. `csv-parse` or `papaparse`) to read the uploaded
buffer. The header row is used to map field names. Key considerations:

- Strip surrounding whitespace from field names and values.
- Handle empty `Completed Date` (produce `null`).
- Parse `Amount` and `Fee` as floats.
- Date strings are in `YYYY-MM-DD HH:mm:ss` format — parse as UTC.

> **Decision needed:** Is `csv-parse` already in the project dependencies, or should
> another library be used?

---

## 6. UI Changes (`ImportPage.tsx`)

1. Add a **`Revolut (CSV)`** option to the `<select id="source-type">` dropdown.
2. When `Revolut` is selected:
   - Change the file input `accept` attribute to `".csv"`.
   - Display an owner selector to use an existing owner.
   - Display an option to select what to do with reverted transactions.
   - POST to `/import/revolut` instead of `/import/bcr`.
3. The success/error display can be reused as-is.


## 7. Report

Every import will generate an import_report.csv file that will be persisted on the server-side.
It will contain information about every skipped transaction (no matter what the reason was).
We should contain as much information as possible (for crashes, we should show why it crashed.
For duplicates, we should tell that rows were duplicate). We need the #row of each skipped entry
specified in the import report.

---

## 8. Out of Scope (for this iteration)

- Multi-currency support (all rows in available data are `RON`).
- Importing the `Balance` column.
- Full deduplication across re-imports using a persistent hash/checksum table.
- Editing or correcting import errors through the UI.
- The lists should correlate transfers between bcr card and revolut card.
  This means they should not appear under 'spent' or 'incoming' money in statistics and graphs.

---

## 9. Open Questions Summary

| # | Question                                                                 | Default / Recommendation         |
|---|--------------------------------------------------------------------------|----------------------------------|
| 1 | Should `TEMP_BLOCK` rows be skipped?                                    | Yes, skip                         |
| 2 | Fee handling: ignore or create separate fee transaction?                | Create Fee transaction         |
| 3 | Duplicate key: `(booking_date, amount, currency, partner.name)` OK?    | Yes, with possible addition of `description` |
| 4 | `description` field value: `"<Type>: <Description>"` composite or just `Description`? | `"<Type>: <Description>"` |
| 5 | CSV parsing library preference?                                         | `csv-parse` (already common in Node ecosystem) |
| 6 | Should partners get `originator = "Revolut"` to mark their source?     | Yes                               |
