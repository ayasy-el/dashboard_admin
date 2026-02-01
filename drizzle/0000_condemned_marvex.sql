-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."transaction_status" AS ENUM('success', 'failed');--> statement-breakpoint
CREATE TABLE "dim_merchant" (
	"merchant_key" uuid PRIMARY KEY NOT NULL,
	"keyword_code" varchar(500) NOT NULL,
	"merchant_name" varchar(500) NOT NULL,
	"uniq_merchant_key" uuid NOT NULL,
	CONSTRAINT "dim_merchant_keyword_code_key" UNIQUE("keyword_code")
);
--> statement-breakpoint
CREATE TABLE "fact_transaction" (
	"transaction_key" uuid PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"uniq_merchant_key" uuid NOT NULL,
	"rule_key" uuid NOT NULL,
	"merchant_key" uuid NOT NULL,
	"status" "transaction_status" NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"point_redeem" integer NOT NULL,
	"msisdn" varchar(16) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dim_rule" (
	"rule_key" uuid PRIMARY KEY NOT NULL,
	"rule_merchant" uuid NOT NULL,
	"point_redeem" integer NOT NULL,
	"start_period" date NOT NULL,
	"end_period" date NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dim_uniq_merchant" (
	"uniq_merchant_key" uuid PRIMARY KEY NOT NULL,
	"uniq_merchant" varchar(500) NOT NULL,
	"region" varchar(500) NOT NULL,
	"branch" varchar(500) NOT NULL,
	"category_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"category_id" integer PRIMARY KEY NOT NULL,
	"category" varchar(500) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dim_merchant" ADD CONSTRAINT "fk_dim_merchant_uniq_merchant_key_dim_uniq_merchant_uniq_mer" FOREIGN KEY ("uniq_merchant_key") REFERENCES "public"."dim_uniq_merchant"("uniq_merchant_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_transaction" ADD CONSTRAINT "fk_fact_transaction_merchant_key_dim_merchant_merchant_key" FOREIGN KEY ("merchant_key") REFERENCES "public"."dim_merchant"("merchant_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_transaction" ADD CONSTRAINT "fk_fact_transaction_rule_key_dim_rule_rule_key" FOREIGN KEY ("rule_key") REFERENCES "public"."dim_rule"("rule_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_transaction" ADD CONSTRAINT "fk_fact_transaction_uniq_merchant_key_dim_uniq_merchant_uniq" FOREIGN KEY ("uniq_merchant_key") REFERENCES "public"."dim_uniq_merchant"("uniq_merchant_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_rule" ADD CONSTRAINT "fk_dim_rule_rule_merchant_dim_merchant_merchant_key" FOREIGN KEY ("rule_merchant") REFERENCES "public"."dim_merchant"("merchant_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dim_uniq_merchant" ADD CONSTRAINT "fk_dim_uniq_merchant_category_id_category_category_id" FOREIGN KEY ("category_id") REFERENCES "public"."category"("category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dim_merchant_index_3" ON "dim_merchant" USING btree ("keyword_code" text_ops);--> statement-breakpoint
CREATE INDEX "dim_merchant_merchant" ON "dim_merchant" USING btree ("uniq_merchant_key" uuid_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_index_6" ON "fact_transaction" USING btree ("msisdn" text_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_merchant" ON "fact_transaction" USING btree ("merchant_key" uuid_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_rule" ON "fact_transaction" USING btree ("rule_key" uuid_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_timestamp" ON "fact_transaction" USING btree ("timestamp" timestamp_ops);--> statement-breakpoint
CREATE INDEX "fact_transaction_uniq_merchant" ON "fact_transaction" USING btree ("uniq_merchant_key" uuid_ops);--> statement-breakpoint
CREATE INDEX "dim_rule_index_3" ON "dim_rule" USING btree ("rule_merchant" date_ops,"start_period" date_ops,"end_period" uuid_ops);--> statement-breakpoint
CREATE INDEX "dim_rule_period" ON "dim_rule" USING btree ("start_period" date_ops,"end_period" date_ops);
*/