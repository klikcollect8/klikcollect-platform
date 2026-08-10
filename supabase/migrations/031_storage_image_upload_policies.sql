-- Storage: product/category/cms image buckets currently only allow public SELECT.
-- App uploads use the service role (bypasses RLS). These policies document intent
-- and allow service tooling that uses the authenticated role if ever needed.
-- Clerk-authenticated Next.js routes should continue uploading via service role.

-- Ensure public read remains for storefront images.
DROP POLICY IF EXISTS product_images_public_read ON storage.objects;
CREATE POLICY product_images_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = ANY (ARRAY['product-images'::text, 'category-images'::text, 'cms-images'::text])
  );

-- Allow service role implicitly (bypasses RLS). No anon insert.
-- Optional: authenticated insert for future Supabase-auth clients.
DROP POLICY IF EXISTS product_images_authenticated_insert ON storage.objects;
CREATE POLICY product_images_authenticated_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['product-images'::text, 'category-images'::text, 'cms-images'::text])
  );

DROP POLICY IF EXISTS product_images_authenticated_update ON storage.objects;
CREATE POLICY product_images_authenticated_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['product-images'::text, 'category-images'::text, 'cms-images'::text])
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['product-images'::text, 'category-images'::text, 'cms-images'::text])
  );

DROP POLICY IF EXISTS product_images_authenticated_delete ON storage.objects;
CREATE POLICY product_images_authenticated_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['product-images'::text, 'category-images'::text, 'cms-images'::text])
  );
