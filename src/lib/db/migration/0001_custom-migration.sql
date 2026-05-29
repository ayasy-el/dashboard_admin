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
-- 4. CHECK CONSTRAINTS
-- ─────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.fact_transaction
    ADD CONSTRAINT ck_fact_transaction_msisdn_digits
      CHECK (msisdn ~ '^[0-9]{8,20}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.fact_transaction
    ADD CONSTRAINT ck_fact_transaction_point_positive CHECK (point_redeem >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.fact_transaction
    ADD CONSTRAINT ck_fact_transaction_qty_valid CHECK (qty >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
      CHECK (role = ANY (ARRAY['merchant'::text, 'admin'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.merchant_feedback
    ADD CONSTRAINT merchant_feedback_status_check
      CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'canceled'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.merchant_feedback
    ADD CONSTRAINT merchant_feedback_type_check
      CHECK (type = ANY (ARRAY['report'::text, 'critic'::text, 'suggestion'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 5. MATERIALIZED VIEWS
-- ─────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS public.vw_overview_transaction CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.vw_merchant_tx_monthly_agg CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.vw_rule_merchant_dim CASCADE;
DROP VIEW IF EXISTS public.vw_overview_transaction CASCADE;
DROP VIEW IF EXISTS public.vw_merchant_tx_monthly_agg CASCADE;
DROP VIEW IF EXISTS public.vw_rule_merchant_dim CASCADE;

CREATE MATERIALIZED VIEW public.vw_overview_transaction AS
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
JOIN public.dim_merchant dm ON dm.merchant_key = ft.merchant_key
JOIN public.dim_category dcat ON dcat.category_id = dm.category_id
JOIN public.dim_cluster dcl ON dcl.cluster_id = dm.cluster_id;

CREATE UNIQUE INDEX IF NOT EXISTS vw_overview_transaction_transaction_key_idx
  ON public.vw_overview_transaction USING btree (transaction_key);

CREATE MATERIALIZED VIEW public.vw_merchant_tx_monthly_agg AS
SELECT
  date_trunc('month', transaction_at)::date AS month_year,
  merchant_key,
  category,
  branch,
  cluster,
  uniq_merchant,
  count(*)::integer AS tx_count,
  count(*) FILTER (WHERE status = 'success'::public.transaction_status)::integer AS success_tx_count,
  count(*) FILTER (WHERE status = 'failed'::public.transaction_status)::integer AS failed_tx_count,
  count(DISTINCT msisdn)::integer AS unique_redeemer,
  count(DISTINCT msisdn) FILTER (WHERE status = 'success'::public.transaction_status)::integer AS unique_redeemer_success,
  COALESCE(
    sum(total_point) FILTER (WHERE status = 'success'::public.transaction_status),
    0
  )::bigint AS total_point_success
FROM public.vw_overview_transaction vt
GROUP BY
  date_trunc('month', transaction_at)::date,
  merchant_key,
  category,
  branch,
  cluster,
  uniq_merchant;

CREATE UNIQUE INDEX IF NOT EXISTS vw_merchant_tx_monthly_agg_month_merchant_idx
  ON public.vw_merchant_tx_monthly_agg USING btree (month_year, merchant_key);

CREATE MATERIALIZED VIEW public.vw_rule_merchant_dim AS
SELECT
  dm.rule_key,
  dm.merchant_key,
  dm.point_redeem,
  dm.start_period,
  dm.end_period,
  dm.merchant_name,
  dm.keyword_code,
  dm.uniq_merchant,
  dm.cluster_id,
  dm.category_id,
  dcat.category,
  dcl.branch,
  dcl.cluster,
  dcl.region
FROM public.dim_merchant dm
JOIN public.dim_category dcat ON dcat.category_id = dm.category_id
JOIN public.dim_cluster dcl ON dcl.cluster_id = dm.cluster_id;

CREATE UNIQUE INDEX IF NOT EXISTS vw_rule_merchant_dim_rule_key_idx
  ON public.vw_rule_merchant_dim USING btree (rule_key);

-- ─────────────────────────────────────────────
-- 6. BANNER MANAGEMENT
-- ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.provider_banners
    RENAME COLUMN image_key TO image_url;
EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TABLE public.program_banner_assets (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY NOT NULL,
    rule_key uuid,
    keyword_code text,
    image_url text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT program_banner_assets_target_check CHECK (num_nonnulls(rule_key, keyword_code) = 1),
    CONSTRAINT program_banner_assets_rule_key_dim_merchant_rule_key_fk
      FOREIGN KEY (rule_key)
      REFERENCES public.dim_merchant(rule_key)
      ON DELETE cascade
      ON UPDATE no action,
    CONSTRAINT program_banner_assets_keyword_code_dim_merchant_keyword_code_fk
      FOREIGN KEY (keyword_code)
      REFERENCES public.dim_merchant(keyword_code)
      ON DELETE cascade
      ON UPDATE no action
  );
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_program_banner_assets_active
  ON public.program_banner_assets USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_program_banner_assets_keyword_code
  ON public.program_banner_assets USING btree (keyword_code);
CREATE INDEX IF NOT EXISTS idx_program_banner_assets_rule_key
  ON public.program_banner_assets USING btree (rule_key);
CREATE UNIQUE INDEX IF NOT EXISTS program_banner_assets_rule_key_unique
  ON public.program_banner_assets USING btree (rule_key);
CREATE UNIQUE INDEX IF NOT EXISTS program_banner_assets_keyword_code_unique
  ON public.program_banner_assets USING btree (keyword_code);

-- ─────────────────────────────────────────────
-- 7. USER ACCOUNT LEGACY MIGRATION
-- ─────────────────────────────────────────────
DO $$
begin
  if to_regclass('public.user_accounts') is null and to_regclass('public.users') is not null then
    alter table public.users rename to user_accounts;
  end if;
end $$;
--> statement-breakpoint
DO $$
begin
  alter table public.user_accounts rename constraint users_email_unique to user_accounts_email_unique;
exception
  when undefined_object or duplicate_object then null;
end $$;
--> statement-breakpoint
DO $$
begin
  alter table public.user_accounts rename constraint users_username_unique to user_accounts_username_unique;
exception
  when undefined_object or duplicate_object then null;
end $$;
--> statement-breakpoint
alter table public.dim_merchant
  add column if not exists user_account_id bigint;
--> statement-breakpoint
DO $$
begin
  if to_regclass('public.merchant_users') is not null then
    update public.dim_merchant dm
    set user_account_id = active_mapping.user_id
    from (
      select distinct on (merchant_key)
        merchant_key,
        user_id
      from public.merchant_users
      where is_active = true
      order by merchant_key, updated_at desc nulls last, created_at desc nulls last
    ) active_mapping
    where dm.merchant_key = active_mapping.merchant_key
      and dm.user_account_id is null;
  end if;
end $$;
--> statement-breakpoint
DO $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dim_merchant_user_account_id_user_accounts_id_fk'
  ) then
    alter table public.dim_merchant
      add constraint dim_merchant_user_account_id_user_accounts_id_fk
      foreign key (user_account_id)
      references public.user_accounts(id)
      on delete set null;
  end if;
end $$;
--> statement-breakpoint
create index if not exists dim_merchant_idx_user_account_id
  on public.dim_merchant using btree (user_account_id);
--> statement-breakpoint
drop table if exists public.merchant_users;
--> statement-breakpoint
drop table if exists public.merchant_canonical_map;
--> statement-breakpoint
drop type if exists public.merchant_scope_type;
--> statement-breakpoint
DO $$
begin
  if to_regclass('public.user_accounts') is not null then
    alter table public.user_accounts drop constraint if exists users_role_check;
    alter table public.user_accounts drop column if exists role;
  end if;
end $$;
