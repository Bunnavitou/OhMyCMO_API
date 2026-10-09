-- Product.price: DOUBLE PRECISION -> DECIMAL(14,2).
--
-- Money must be exact; floats drift by fractions of a cent once added up.
-- Every existing value is converted in place: same rows, same ids, only the
-- column type changes.
--
-- Safety check first: if any price has more than 2 decimal places, converting
-- would round it. Rather than change data silently, abort the whole migration
-- (nothing is altered) and list the products so they can be reviewed.
DO $$
DECLARE
  bad TEXT;
BEGIN
  SELECT string_agg(id || '=' || price::text, ', ')
    INTO bad
    FROM "Product"
   WHERE price::numeric <> round(price::numeric, 2);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Product.price has values with more than 2 decimals: %', bad;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE DECIMAL(14,2) USING round("price"::numeric, 2),
  ALTER COLUMN "price" SET DEFAULT 0;
