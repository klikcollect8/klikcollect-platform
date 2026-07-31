-- Migration: Add Full Text Search to Products
-- Adds a generated column for search and a GIN index

-- Step 1: Add the search vector column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS fts_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'C')
) STORED;

-- Step 2: Create a GIN index for the fts_vector column
CREATE INDEX IF NOT EXISTS idx_products_fts ON products USING GIN (fts_vector);

-- Step 3: Add a function for searching products (optional but helpful for API)
CREATE OR REPLACE FUNCTION search_products(query_text TEXT)
RETURNS SETOF products
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM products
  WHERE fts_vector @@ plainto_tsquery('english', query_text)
  ORDER BY ts_rank(fts_vector, plainto_tsquery('english', query_text)) DESC;
$$;
