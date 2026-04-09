CREATE TABLE IF NOT EXISTS "audit"."ingestion_issues" (
	"issue_id" bigserial PRIMARY KEY NOT NULL,
	"issue_fingerprint" text NOT NULL,
	"dataset" text NOT NULL,
	"issue_kind" text NOT NULL,
	"conflict_merchant_key" uuid,
	"conflict_start_period" date,
	"conflict_end_period" date,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_ingestion_issues_fingerprint" ON "audit"."ingestion_issues" USING btree ("issue_fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_issues_status" ON "audit"."ingestion_issues" USING btree ("status","dataset");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ingestion_issues_conflict_scope" ON "audit"."ingestion_issues" USING btree ("issue_kind","conflict_merchant_key","conflict_start_period","conflict_end_period");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit"."batch_issue_links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"batch_id" uuid NOT NULL,
	"issue_id" bigint NOT NULL,
	"rejected_row_id" bigint NOT NULL,
	"row_num" integer NOT NULL,
	"state" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit"."batch_issue_links"
	ADD CONSTRAINT "fk_batch_issue_links_batch"
	FOREIGN KEY ("batch_id") REFERENCES "audit"."batches"("batch_id")
	ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "audit"."batch_issue_links"
	ADD CONSTRAINT "fk_batch_issue_links_issue"
	FOREIGN KEY ("issue_id") REFERENCES "audit"."ingestion_issues"("issue_id")
	ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_batch_issue_links_batch_rejected" ON "audit"."batch_issue_links" USING btree ("batch_id","rejected_row_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batch_issue_links_issue_state" ON "audit"."batch_issue_links" USING btree ("issue_id","state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_batch_issue_links_batch_state" ON "audit"."batch_issue_links" USING btree ("batch_id","state");
