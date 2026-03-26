-- Ensure the "Others" category always exists with id = 1
INSERT INTO categories (id, name, parent, "index")
VALUES (1, 'Others', NULL, 0)
ON CONFLICT (id) DO NOTHING;

-- Bump the sequence so new categories never accidentally get id = 1
SELECT setval(
    pg_get_serial_sequence('categories', 'id'),
    GREATEST(1, (SELECT MAX(id) FROM categories))
);

-- Backfill: set all partners with no category to Others
UPDATE partners
SET category_id = 1
WHERE category_id IS NULL;

-- Backfill: set all transactions with no category to their partner's category (or Others)
UPDATE transactions t
SET category_id = COALESCE(p.category_id, 1)
FROM partners p
WHERE t.partner_id = p.id
  AND t.category_id IS NULL;

-- Backfill: set any remaining transactions with no category (no partner) to Others
UPDATE transactions
SET category_id = 1
WHERE category_id IS NULL;
