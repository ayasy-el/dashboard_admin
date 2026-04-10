ALTER TABLE "merchant_feedback"
  ADD COLUMN IF NOT EXISTS "attachment_key" text,
  ADD COLUMN IF NOT EXISTS "attachment_file_name" text,
  ADD COLUMN IF NOT EXISTS "attachment_mime_type" text,
  ADD COLUMN IF NOT EXISTS "attachment_size" integer;

ALTER TABLE "merchant_feedback"
  DROP CONSTRAINT IF EXISTS "merchant_feedback_status_check";

ALTER TABLE "merchant_feedback"
  ADD CONSTRAINT "merchant_feedback_status_check"
  CHECK ("merchant_feedback"."status" in ('open', 'in_progress', 'resolved', 'canceled'));
