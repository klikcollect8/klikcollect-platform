-- Align curation_applications with storefront CurationApplication shape
ALTER TABLE public.curation_applications
  ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE public.curation_applications
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.curation_applications
  DROP CONSTRAINT IF EXISTS curation_applications_status_check;

ALTER TABLE public.curation_applications
  ADD CONSTRAINT curation_applications_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'admitted'::text, 'rejected'::text, 'decided'::text]));

UPDATE public.curation_applications ca
SET status = 'admitted',
    payload = jsonb_build_object(
      'businessName', COALESCE(v.name, ca.public_id),
      'neighbourhood', COALESCE(v.neighbourhood, 'Nairobi'),
      'contactEmail', COALESCE(v.contact_email, 'vendor@klikcollect.local'),
      'contactPhone', COALESCE(v.contact_phone, ''),
      'categories', CASE WHEN v.specialty IS NOT NULL THEN jsonb_build_array(v.specialty) ELSE '[]'::jsonb END,
      'notes', ca.pitch,
      'decision', jsonb_build_object(
        'decidedAt', ca.created_at,
        'decidedBy', 'seed',
        'outcome', 'admitted',
        'criteriaChecked', '[]'::jsonb,
        'reason', 'Founding cohort seed'
      )
    )
FROM public.vendors v
WHERE ca.vendor_id = v.id AND ca.status = 'decided';
