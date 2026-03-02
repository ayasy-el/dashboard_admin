CREATE TYPE "public"."transaction_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TABLE "dim_category" (
	"category_id" integer PRIMARY KEY NOT NULL,
	"category" varchar(500) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dim_cluster" (
	"cluster_id" bigint PRIMARY KEY NOT NULL,
	"cluster" varchar(500) NOT NULL,
	"branch" varchar(500) NOT NULL,
	"region" varchar(500) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dim_merchant" (
	"merchant_key" uuid PRIMARY KEY NOT NULL,
	"keyword_code" varchar(500) NOT NULL,
	"merchant_name" varchar(500) NOT NULL,
	"uniq_merchant" varchar(500) NOT NULL,
	"cluster_id" bigint NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "dim_merchant_keyword_code_key" UNIQUE("keyword_code")
);
--> statement-breakpoint
CREATE TABLE "dim_rule" (
	"rule_key" uuid PRIMARY KEY NOT NULL,
	"rule_merchant" uuid NOT NULL,
	"point_redeem" integer NOT NULL,
	"start_period" date NOT NULL,
	"end_period" date NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "ck_dim_rule_period_valid" CHECK (start_period <= end_period),
	CONSTRAINT "ck_dim_rule_point_positive" CHECK (point_redeem >= 0)
);
--> statement-breakpoint
CREATE TABLE "fact_cluster_point" (
	"point_key" uuid PRIMARY KEY NOT NULL,
	"month_year" date NOT NULL,
	"cluster_id" bigint NOT NULL,
	"total_point" bigint NOT NULL,
	"point_owner" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact_transaction" (
	"transaction_key" uuid PRIMARY KEY NOT NULL,
	"transaction_at" timestamp NOT NULL,
	"rule_key" uuid NOT NULL,
	"merchant_key" uuid NOT NULL,
	"status" "transaction_status" NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"point_redeem" integer NOT NULL,
	"msisdn" varchar(20) NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "ck_fact_transaction_qty_valid" CHECK (qty >= 1),
	CONSTRAINT "ck_fact_transaction_point_positive" CHECK (point_redeem >= 0),
	CONSTRAINT "ck_fact_transaction_msisdn_digits" CHECK ((msisdn)::text ~ '^[0-9]{8,20}$'::text)
);
--> statement-breakpoint
ALTER TABLE "dim_merchant" ADD CONSTRAINT "fk_dim_merchant_category_id_dim_category_category_id" FOREIGN KEY ("category_id") REFERENCES "public"."dim_category"("category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_merchant" ADD CONSTRAINT "fk_dim_merchant_cluster_id_dim_cluster_cluster_id" FOREIGN KEY ("cluster_id") REFERENCES "public"."dim_cluster"("cluster_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_rule" ADD CONSTRAINT "fk_dim_rule_rule_merchant_dim_merchant_merchant_key" FOREIGN KEY ("rule_merchant") REFERENCES "public"."dim_merchant"("merchant_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_cluster_point" ADD CONSTRAINT "fk_fact_cluster_point_cluster_id_dim_cluster_cluster_id" FOREIGN KEY ("cluster_id") REFERENCES "public"."dim_cluster"("cluster_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_transaction" ADD CONSTRAINT "fk_fact_transaction_merchant_key_dim_merchant_merchant_key" FOREIGN KEY ("merchant_key") REFERENCES "public"."dim_merchant"("merchant_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_transaction" ADD CONSTRAINT "fk_fact_transaction_rule_key_dim_rule_rule_key" FOREIGN KEY ("rule_key") REFERENCES "public"."dim_rule"("rule_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dim_merchant_idx_dim_merchant_category_id" ON "dim_merchant" USING btree ("category_id" int4_ops);--> statement-breakpoint
CREATE INDEX "dim_merchant_idx_dim_merchant_cluster_id" ON "dim_merchant" USING btree ("cluster_id" int8_ops);--> statement-breakpoint
CREATE INDEX "dim_rule_idx_dim_rule_end_period" ON "dim_rule" USING btree ("end_period" date_ops);--> statement-breakpoint
CREATE INDEX "dim_rule_index_3" ON "dim_rule" USING btree ("rule_merchant" date_ops,"start_period" date_ops,"end_period" uuid_ops);--> statement-breakpoint
CREATE INDEX "fact_cluster_point_idx_fcp_month_cluster" ON "fact_cluster_point" USING btree ("month_year" date_ops,"cluster_id" date_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_idx_ft_merchant_status_time" ON "fact_transaction" USING btree ("merchant_key" timestamp_ops,"status" enum_ops,"transaction_at" enum_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_index_6" ON "fact_transaction" USING btree ("msisdn" text_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_rule" ON "fact_transaction" USING btree ("rule_key" uuid_ops);