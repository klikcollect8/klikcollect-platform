-- Allow semantic media roles from Open Food Facts (ingredients / nutrition / packaging).
ALTER TABLE public.product_media
  DROP CONSTRAINT IF EXISTS product_media_role_check;

ALTER TABLE public.product_media
  ADD CONSTRAINT product_media_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'main'::text,
        'gallery'::text,
        'variant'::text,
        'ingredients'::text,
        'nutrition'::text,
        'packaging'::text
      ]
    )
  );
