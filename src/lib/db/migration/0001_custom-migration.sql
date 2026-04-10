-- =============================================================================
-- migration_custom.sql
--
-- Jalankan file ini SEBELUM atau BERSAMAAN dengan migrasi Drizzle pertama.
-- Berisi DDL yang tidak dapat di-generate oleh Drizzle secara native:
--   1. Schemas tambahan
--   2. Extensions
--   3. ENUM types
--   4. GiST index pada daterange
--   5. EXCLUDE constraint (overlap prevention)
--   6. CHECK constraints dengan regex / array literal
--   7. Views
-- =============================================================================

-- ─────────────────────────────────────────────
-- 1. SCHEMAS
-- ─────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS stg;

-- ─────────────────────────────────────────────
-- 2. EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto    WITH SCHEMA public;

-- ─────────────────────────────────────────────
-- 3. ENUM TYPES
-- (Drizzle menghasilkan CREATE TYPE lewat pgEnum,
--  tapi letakkan di sini jika ingin kontrol urutan eksplisit)
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.merchant_scope_type AS ENUM ('merchant', 'canonical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM ('success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 4. GiST INDEX pada dim_rule.period
--    (Drizzle hanya support btree di index builder;
--     GiST harus pakai SQL langsung)
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS dim_rule_idx_dim_rule_period
  ON public.dim_rule USING gist (period);

-- ─────────────────────────────────────────────
-- 5. EXCLUDE CONSTRAINT — dim_rule
--    Mencegah period overlap untuk merchant yang sama.
--    Membutuhkan extension btree_gist (sudah di-create di atas).
-- ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.dim_rule
    ADD CONSTRAINT ex_dim_rule_no_overlap
      EXCLUDE USING gist (rule_merchant WITH =, period WITH &&);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 6. CHECK CONSTRAINTS
-- ─────────────────────────────────────────────

-- dim_rule: period tidak boleh empty range
DO $$ BEGIN
  ALTER TABLE public.dim_rule
    ADD CONSTRAINT ck_dim_rule_period_valid CHECK (NOT isempty(period));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- dim_rule: point_redeem >= 0
DO $$ BEGIN
  ALTER TABLE public.dim_rule
    ADD CONSTRAINT ck_dim_rule_point_positive CHECK (point_redeem >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- fact_transaction: msisdn hanya digit 8–20 karakter
DO $$ BEGIN
  ALTER TABLE public.fact_transaction
    ADD CONSTRAINT ck_fact_transaction_msisdn_digits
      CHECK (msisdn ~ '^[0-9]{8,20}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- fact_transaction: point_redeem >= 0
DO $$ BEGIN
  ALTER TABLE public.fact_transaction
    ADD CONSTRAINT ck_fact_transaction_point_positive CHECK (point_redeem >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- fact_transaction: qty >= 1
DO $$ BEGIN
  ALTER TABLE public.fact_transaction
    ADD CONSTRAINT ck_fact_transaction_qty_valid CHECK (qty >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users: role hanya 'merchant' atau 'admin'
DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
      CHECK (role = ANY (ARRAY['merchant'::text, 'admin'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- merchant_feedback: status
DO $$ BEGIN
  ALTER TABLE public.merchant_feedback
    ADD CONSTRAINT merchant_feedback_status_check
      CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'canceled'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- merchant_feedback: type
DO $$ BEGIN
  ALTER TABLE public.merchant_feedback
    ADD CONSTRAINT merchant_feedback_type_check
      CHECK (type = ANY (ARRAY['report'::text, 'critic'::text, 'suggestion'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 7. VIEWS
-- ─────────────────────────────────────────────

-- vw_overview_transaction
CREATE OR REPLACE VIEW public.vw_overview_transaction AS
SELECT
  ft.transaction_key,
  ft.transaction_at,
  ft.status,
  ft.merchant_key,
  ft.qty,
  ft.point_redeem,
  (ft.qty * ft.point_redeem)::bigint AS total_point,
  ft.msisdn,
  dm.keyword_code,
  dm.merchant_name,
  dm.uniq_merchant,
  dcat.category_id,
  dcat.category,
  dcl.cluster_id,
  dcl.cluster,
  dcl.branch,
  dcl.region
FROM public.fact_transaction ft
JOIN public.dim_merchant  dm   ON dm.merchant_key   = ft.merchant_key
JOIN public.dim_category  dcat ON dcat.category_id  = dm.category_id
JOIN public.dim_cluster   dcl  ON dcl.cluster_id    = dm.cluster_id;

-- vw_merchant_tx_monthly_agg
CREATE OR REPLACE VIEW public.vw_merchant_tx_monthly_agg AS
SELECT
  date_trunc('month', transaction_at)::date AS month_year,
  merchant_key,
  category,
  branch,
  cluster,
  uniq_merchant,
  count(*)::integer                                                                    AS tx_count,
  count(*) FILTER (WHERE status = 'success'::public.transaction_status)::integer      AS success_tx_count,
  count(*) FILTER (WHERE status = 'failed'::public.transaction_status)::integer       AS failed_tx_count,
  count(DISTINCT msisdn)::integer                                                      AS unique_redeemer,
  count(DISTINCT msisdn) FILTER (WHERE status = 'success'::public.transaction_status)::integer
                                                                                       AS unique_redeemer_success,
  COALESCE(
    sum(total_point) FILTER (WHERE status = 'success'::public.transaction_status),
    0
  )::bigint                                                                            AS total_point_success
FROM public.vw_overview_transaction vt
GROUP BY
  date_trunc('month', transaction_at)::date,
  merchant_key,
  category,
  branch,
  cluster,
  uniq_merchant;

-- vw_rule_merchant_dim
CREATE OR REPLACE VIEW public.vw_rule_merchant_dim AS
SELECT
  dr.rule_key,
  dr.rule_merchant          AS merchant_key,
  dr.point_redeem,
  dr.period,
  lower(dr.period)          AS start_period,
  (upper(dr.period) - '1 day'::interval)::date AS end_period,
  dm.merchant_name,
  dm.keyword_code,
  dm.uniq_merchant,
  dm.cluster_id,
  dm.category_id,
  dcat.category,
  dcl.branch,
  dcl.cluster,
  dcl.region
FROM public.dim_rule        dr
JOIN public.dim_merchant  dm   ON dm.merchant_key  = dr.rule_merchant
JOIN public.dim_category  dcat ON dcat.category_id = dm.category_id
JOIN public.dim_cluster   dcl  ON dcl.cluster_id   = dm.cluster_id;