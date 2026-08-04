-- Applicant identity, edit budget, and spam guards for sell applications

ALTER TABLE public.curation_applications
  ADD COLUMN IF NOT EXISTS clerk_user_id text,
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS curation_applications_clerk_user_id_idx
  ON public.curation_applications (clerk_user_id);

-- At most one pending application per signed-in user
CREATE UNIQUE INDEX IF NOT EXISTS curation_one_pending_per_user
  ON public.curation_applications (clerk_user_id)
  WHERE status = 'pending' AND clerk_user_id IS NOT NULL;

COMMENT ON COLUMN public.curation_applications.clerk_user_id IS
  'Clerk user id of the applicant (required for storefront submissions).';
COMMENT ON COLUMN public.curation_applications.edit_count IS
  'Number of applicant edits after first submit (max 3).';
