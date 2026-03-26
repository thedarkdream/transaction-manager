-- Add color column to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR;

-- Give "Others" a default neutral gray
UPDATE categories SET color = '#6b7280' WHERE id = 1 AND color IS NULL;
