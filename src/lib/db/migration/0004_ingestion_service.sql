CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "audit";--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS "stg";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit"."batches" (
	"batch_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset" text NOT NULL,
	"status" text NOT NULL,
	"source_file" text NOT NULL,
	"failed_step" text,
	"failed_reason" text,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"loaded_rows" integer DEFAULT 0 NOT NULL,
	"rejected_rows" integer DEFAULT 0 NOT NULL,
	"reject_rate" numeric(8, 6) DEFAULT 0 NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."rejected_rows" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"dataset" text NOT NULL,
	"row_num" integer NOT NULL,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."list_kota_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."master_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."transactions_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."total_point_raw" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."list_kota_clean" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"region" text NOT NULL,
	"branch" text NOT NULL,
	"cluster" text NOT NULL,
	"cluster_id" bigint NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."master_clean" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"uniq_merchant" text NOT NULL,
	"merchant_name" text NOT NULL,
	"keyword" text NOT NULL,
	"category" text NOT NULL,
	"point_redeem" integer NOT NULL,
	"start_period" date NOT NULL,
	"end_period" date NOT NULL,
	"region" text NOT NULL,
	"branch" text NOT NULL,
	"cluster" text NOT NULL,
	"merchant_key" uuid NOT NULL,
	"category_id" integer NOT NULL,
	"cluster_id" bigint NOT NULL,
	"rule_key" uuid NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."transactions_clean" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"transaction_key" uuid NOT NULL,
	"transaction_at" timestamp NOT NULL,
	"keyword" text NOT NULL,
	"msisdn" text NOT NULL,
	"qty" integer NOT NULL,
	"status" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stg"."total_point_clean" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_num" integer NOT NULL,
	"point_key" uuid NOT NULL,
	"cluster" text NOT NULL,
	"cluster_id" bigint NOT NULL,
	"month_year" date NOT NULL,
	"total_point" bigint NOT NULL,
	"point_owner" bigint NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batches_dataset_status" ON "audit"."batches" USING btree ("dataset","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batches_created_at" ON "audit"."batches" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rejected_batch" ON "stg"."rejected_rows" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_list_kota_raw_batch" ON "stg"."list_kota_raw" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_master_raw_batch" ON "stg"."master_raw" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_raw_batch" ON "stg"."transactions_raw" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_total_point_raw_batch" ON "stg"."total_point_raw" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_list_kota_clean_batch" ON "stg"."list_kota_clean" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_master_clean_batch" ON "stg"."master_clean" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_transactions_clean_batch" ON "stg"."transactions_clean" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_total_point_clean_batch" ON "stg"."total_point_clean" USING btree ("batch_id","row_num");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "total_point_clean_batch_row_month_unique" ON "stg"."total_point_clean" USING btree ("batch_id","row_num","month_year");
