/**
 * schema.ts — Drizzle ORM (drizzle-orm/pg-core)
 *
 * Covers 3 PostgreSQL schemas:
 *   • public  — core domain tables + views
 *   • audit   — batch / ingestion-issue tracking
 *   • stg     — staging (ETL) tables
 *
 * Custom migration SQL (migration_custom.sql) handles:
 *   - Extensions  : btree_gist, pgcrypto
 *   - ENUM types  : merchant_scope_type, transaction_status
 *   - GiST index  : dim_rule_idx_dim_rule_period
 *   - EXCLUDE constraint : ex_dim_rule_no_overlap
 *   - VIEWs       : vw_overview_transaction, vw_merchant_tx_monthly_agg, vw_rule_merchant_dim
 *   - CHECK constraints with regex / array literals (Drizzle does not generate these natively)
 */

import {
  pgTable,
  pgSchema,
  pgEnum,
  pgView,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  bigserial,
  boolean,
  numeric,
  timestamp,
  date,
  jsonb,
  unique,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────
// Custom type: daterange  (PostgreSQL built-in, not in Drizzle)
// ─────────────────────────────────────────────
const daterange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "daterange";
  },
});

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────
export const auditSchema = pgSchema("audit");
export const stgSchema = pgSchema("stg");
// "public" is the default schema; no pgSchema needed.

// ─────────────────────────────────────────────
// ENUMs  (must exist before tables that reference them)
// ─────────────────────────────────────────────
export const merchantScopeTypeEnum = pgEnum("merchant_scope_type", ["merchant", "canonical"]);

export const transactionStatusEnum = pgEnum("transaction_status", ["success", "failed"]);

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA: public
// ═══════════════════════════════════════════════════════════════════════════

// ── admin_users ──────────────────────────────
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    email: varchar("email", { length: 320 }).notNull().unique("admin_users_email_unique"),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("admin_users_active_idx").on(t.isActive)],
);

// ── admin_sessions ───────────────────────────
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash")
      .notNull()
      .unique("admin_sessions_token_hash_unique"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "string" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    index("admin_sessions_expires_at_idx").on(t.expiresAt),
    index("admin_sessions_user_id_idx").on(t.userId),
  ],
);

// ── users ─────────────────────────────────────
// role CHECK constraint: ('merchant','admin') → handled in migration_custom.sql
export const users = pgTable("users", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey().notNull(),
  email: text("email").notNull().unique("users_email_unique"),
  username: text("username").unique("users_username_unique"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("merchant").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

// ── dim_category ──────────────────────────────
export const dimCategory = pgTable("dim_category", {
  categoryId: integer("category_id").primaryKey().notNull(),
  category: varchar("category", { length: 500 }).notNull(),
});

// ── dim_cluster ───────────────────────────────
export const dimCluster = pgTable("dim_cluster", {
  clusterId: bigint("cluster_id", { mode: "number" }).primaryKey().notNull(),
  cluster: varchar("cluster", { length: 500 }).notNull(),
  branch: varchar("branch", { length: 500 }).notNull(),
  region: varchar("region", { length: 500 }).notNull(),
});

// ── dim_merchant ──────────────────────────────
export const dimMerchant = pgTable(
  "dim_merchant",
  {
    merchantKey: uuid("merchant_key").primaryKey().notNull(),
    keywordCode: varchar("keyword_code", { length: 500 })
      .notNull()
      .unique("dim_merchant_keyword_code_key"),
    merchantName: varchar("merchant_name", { length: 500 }).notNull(),
    uniqMerchant: varchar("uniq_merchant", { length: 500 }).notNull(),
    clusterId: bigint("cluster_id", { mode: "number" })
      .notNull()
      .references(() => dimCluster.clusterId),
    categoryId: integer("category_id")
      .notNull()
      .references(() => dimCategory.categoryId),
  },
  (t) => [
    index("dim_merchant_idx_dim_merchant_category_id").on(t.categoryId),
    index("dim_merchant_idx_dim_merchant_cluster_id").on(t.clusterId),
  ],
);

// ── dim_rule ──────────────────────────────────
// CHECK constraints and EXCLUDE constraint → migration_custom.sql
// daterange column uses customType above
export const dimRule = pgTable(
  "dim_rule",
  {
    ruleKey: uuid("rule_key").primaryKey().notNull(),
    ruleMerchant: uuid("rule_merchant")
      .notNull()
      .references(() => dimMerchant.merchantKey),
    pointRedeem: integer("point_redeem").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    period: daterange("period").notNull(),
  },
  (t) => [
    index("dim_rule_idx_dim_rule_merchant").on(t.ruleMerchant),
    // GiST index on period → migration_custom.sql (dim_rule_idx_dim_rule_period)
  ],
);

// ── fact_cluster_point ────────────────────────
export const factClusterPoint = pgTable(
  "fact_cluster_point",
  {
    pointKey: uuid("point_key").primaryKey().notNull(),
    monthYear: date("month_year").notNull(),
    clusterId: bigint("cluster_id", { mode: "number" })
      .notNull()
      .references(() => dimCluster.clusterId),
    totalPoint: bigint("total_point", { mode: "number" }).notNull(),
    pointOwner: bigint("point_owner", { mode: "number" }).notNull(),
  },
  (t) => [index("fact_cluster_point_idx_fcp_month_cluster").on(t.monthYear, t.clusterId)],
);

// ── fact_transaction ──────────────────────────
// CHECK constraints (msisdn regex, point_positive, qty_valid) → migration_custom.sql
export const factTransaction = pgTable(
  "fact_transaction",
  {
    transactionKey: uuid("transaction_key").primaryKey().notNull(),
    transactionAt: timestamp("transaction_at", { mode: "string" }).notNull(),
    ruleKey: uuid("rule_key")
      .notNull()
      .references(() => dimRule.ruleKey),
    merchantKey: uuid("merchant_key")
      .notNull()
      .references(() => dimMerchant.merchantKey),
    status: transactionStatusEnum("status").notNull(),
    qty: integer("qty").default(1).notNull(),
    pointRedeem: integer("point_redeem").notNull(),
    msisdn: varchar("msisdn", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (t) => [
    index("fact_transaction_idx_ft_merchant_status_time").on(
      t.merchantKey,
      t.status,
      t.transactionAt,
    ),
    index("fact_transaction_index_6").on(t.msisdn),
    index("fact_transaction_rule").on(t.ruleKey),
  ],
);

// ── merchant_canonical_map ────────────────────
export const merchantCanonicalMap = pgTable("merchant_canonical_map", {
  merchantKey: uuid("merchant_key").primaryKey().notNull(),
  canonicalMerchantKey: uuid("canonical_merchant_key").notNull(),
  uniqMerchant: text("uniq_merchant").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).default(sql`now()`),
});

// ── merchant_feedback ─────────────────────────
// status CHECK ('open','in_progress','resolved','canceled') → migration_custom.sql
// type   CHECK ('report','critic','suggestion')             → migration_custom.sql
export const merchantFeedback = pgTable(
  "merchant_feedback",
  {
    id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey().notNull(),
    merchantKey: uuid("merchant_key").notNull(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    status: text("status").default("open").notNull(),
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    attachmentKey: text("attachment_key"),
    attachmentFileName: text("attachment_file_name"),
    attachmentMimeType: text("attachment_mime_type"),
    attachmentSize: integer("attachment_size"),
  },
  (t) => [
    index("idx_merchant_feedback_merchant").on(t.merchantKey),
    index("idx_merchant_feedback_status").on(t.status),
    index("idx_merchant_feedback_user").on(t.userId),
  ],
);

// ── merchant_users ────────────────────────────
export const merchantUsers = pgTable(
  "merchant_users",
  {
    userId: bigint("user_id", { mode: "number" })
      .primaryKey()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    merchantKey: uuid("merchant_key").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    scopeType: merchantScopeTypeEnum("scope_type").default("merchant").notNull(),
  },
  (t) => [
    unique("merchant_users_user_id_merchant_key_unique").on(t.userId, t.merchantKey),
    index("idx_merchant_users_merchant_key").on(t.merchantKey),
  ],
);

// ── provider_banners ──────────────────────────
export const providerBanners = pgTable(
  "provider_banners",
  {
    id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey().notNull(),
    imageKey: text("image_key").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    cta: text("cta").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_provider_banners_active").on(t.isActive),
    index("idx_provider_banners_sort").on(t.sortOrder),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA: audit
// ═══════════════════════════════════════════════════════════════════════════

// ── audit.batches ──────────────────────────────
export const auditBatches = auditSchema.table(
  "batches",
  {
    batchId: uuid("batch_id").defaultRandom().primaryKey().notNull(),
    dataset: text("dataset").notNull(),
    status: text("status").notNull(),
    sourceFile: text("source_file").notNull(),
    failedStep: text("failed_step"),
    failedReason: text("failed_reason"),
    totalRows: integer("total_rows").default(0).notNull(),
    loadedRows: integer("loaded_rows").default(0).notNull(),
    rejectedRows: integer("rejected_rows").default(0).notNull(),
    rejectRate: numeric("reject_rate", { precision: 8, scale: 6 }).default("0").notNull(),
    runCount: integer("run_count").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().notNull(),
    batchPublicId: text("batch_public_id").notNull(),
  },
  (t) => [
    uniqueIndex("ux_batches_public_id").on(t.batchPublicId),
    index("idx_batches_created_at").on(t.createdAt),
    index("idx_batches_dataset_status").on(t.dataset, t.status),
  ],
);

// ── audit.ingestion_issues ────────────────────
export const auditIngestionIssues = auditSchema.table(
  "ingestion_issues",
  {
    issueId: bigserial("issue_id", { mode: "number" }).primaryKey().notNull(),
    issueFingerprint: text("issue_fingerprint").notNull(),
    dataset: text("dataset").notNull(),
    issueKind: text("issue_kind").notNull(),
    conflictMerchantKey: uuid("conflict_merchant_key"),
    conflictStartPeriod: date("conflict_start_period"),
    conflictEndPeriod: date("conflict_end_period"),
    errorType: text("error_type").notNull(),
    errorMessage: text("error_message").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    status: text("status").default("OPEN").notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByBatchId: uuid("resolved_by_batch_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ux_ingestion_issues_fingerprint").on(t.issueFingerprint),
    index("idx_ingestion_issues_status").on(t.status, t.dataset),
    index("idx_ingestion_issues_conflict_scope").on(
      t.issueKind,
      t.conflictMerchantKey,
      t.conflictStartPeriod,
      t.conflictEndPeriod,
    ),
  ],
);

// ── audit.batch_issue_links ───────────────────
export const auditBatchIssueLinks = auditSchema.table(
  "batch_issue_links",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => auditBatches.batchId, { onDelete: "cascade" }),
    issueId: bigint("issue_id", { mode: "number" })
      .notNull()
      .references(() => auditIngestionIssues.issueId, { onDelete: "cascade" }),
    rowNum: integer("row_num").notNull(),
    state: text("state").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    dataset: text("dataset").notNull(),
    errorType: text("error_type").notNull(),
    errorMessage: text("error_message").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
  },
  (t) => [
    uniqueIndex("ux_batch_issue_links_batch_row_issue").on(t.batchId, t.rowNum, t.issueId),
    index("idx_batch_issue_links_batch_state").on(t.batchId, t.state),
    index("idx_batch_issue_links_issue_state").on(t.issueId, t.state),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA: stg  (staging / ETL)
// ═══════════════════════════════════════════════════════════════════════════

// ── stg.list_kota_raw ──────────────────────────
export const stgListKotaRaw = stgSchema.table(
  "list_kota_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_list_kota_raw_batch").on(t.batchId, t.rowNum)],
);

// ── stg.list_kota_clean ───────────────────────
export const stgListKotaClean = stgSchema.table(
  "list_kota_clean",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    region: text("region").notNull(),
    branch: text("branch").notNull(),
    cluster: text("cluster").notNull(),
    clusterId: bigint("cluster_id", { mode: "number" }).notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_list_kota_clean_batch").on(t.batchId, t.rowNum)],
);

// ── stg.master_raw ─────────────────────────────
export const stgMasterRaw = stgSchema.table(
  "master_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_master_raw_batch").on(t.batchId, t.rowNum)],
);

// ── stg.master_clean ───────────────────────────
export const stgMasterClean = stgSchema.table(
  "master_clean",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    uniqMerchant: text("uniq_merchant").notNull(),
    merchantName: text("merchant_name").notNull(),
    keyword: text("keyword").notNull(),
    category: text("category").notNull(),
    pointRedeem: integer("point_redeem").notNull(),
    startPeriod: date("start_period").notNull(),
    endPeriod: date("end_period").notNull(),
    region: text("region").notNull(),
    branch: text("branch").notNull(),
    cluster: text("cluster").notNull(),
    merchantKey: uuid("merchant_key").notNull(),
    categoryId: integer("category_id").notNull(),
    clusterId: bigint("cluster_id", { mode: "number" }).notNull(),
    ruleKey: uuid("rule_key").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_master_clean_batch").on(t.batchId, t.rowNum)],
);

// ── stg.total_point_raw ────────────────────────
export const stgTotalPointRaw = stgSchema.table(
  "total_point_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_total_point_raw_batch").on(t.batchId, t.rowNum)],
);

// ── stg.total_point_clean ──────────────────────
export const stgTotalPointClean = stgSchema.table(
  "total_point_clean",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    pointKey: uuid("point_key").notNull(),
    cluster: text("cluster").notNull(),
    clusterId: bigint("cluster_id", { mode: "number" }).notNull(),
    monthYear: date("month_year").notNull(),
    totalPoint: bigint("total_point", { mode: "number" }).notNull(),
    pointOwner: bigint("point_owner", { mode: "number" }).notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_total_point_clean_batch").on(t.batchId, t.rowNum),
    uniqueIndex("total_point_clean_batch_row_month_unique").on(t.batchId, t.rowNum, t.monthYear),
  ],
);

// ── stg.transactions_raw ───────────────────────
export const stgTransactionsRaw = stgSchema.table(
  "transactions_raw",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_transactions_raw_batch").on(t.batchId, t.rowNum)],
);

// ═══════════════════════════════════════════════════════════════════════════
// VIEWS  (existing — defined via migration_custom.sql, declared here for
//         type-safe querying with Drizzle's query builder)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * vw_overview_transaction
 * Gabungan fact_transaction + dim_merchant + dim_category + dim_cluster.
 * DDL dikelola oleh migration_custom.sql — Drizzle tidak akan generate DDL ini.
 */
export const vwOverviewTransaction = pgView("vw_overview_transaction", {
  transactionKey: uuid("transaction_key"),
  transactionAt: timestamp("transaction_at", { mode: "string" }),
  status: transactionStatusEnum("status"),
  merchantKey: uuid("merchant_key"),
  qty: integer("qty"),
  pointRedeem: integer("point_redeem"),
  totalPoint: bigint("total_point", { mode: "number" }),
  msisdn: varchar("msisdn", { length: 20 }),
  keywordCode: varchar("keyword_code", { length: 500 }),
  merchantName: varchar("merchant_name", { length: 500 }),
  uniqMerchant: varchar("uniq_merchant", { length: 500 }),
  categoryId: integer("category_id"),
  category: varchar("category", { length: 500 }),
  clusterId: bigint("cluster_id", { mode: "number" }),
  cluster: varchar("cluster", { length: 500 }),
  branch: varchar("branch", { length: 500 }),
  region: varchar("region", { length: 500 }),
}).existing();

/**
 * vw_merchant_tx_monthly_agg
 * Agregasi transaksi per bulan, merchant, kategori, cluster.
 * DDL dikelola oleh migration_custom.sql — Drizzle tidak akan generate DDL ini.
 */
export const vwMerchantTxMonthlyAgg = pgView("vw_merchant_tx_monthly_agg", {
  monthYear: date("month_year", { mode: "string" }),
  merchantKey: uuid("merchant_key"),
  category: text("category"),
  branch: text("branch"),
  cluster: text("cluster"),
  uniqMerchant: text("uniq_merchant"),
  txCount: integer("tx_count"),
  successTxCount: integer("success_tx_count"),
  failedTxCount: integer("failed_tx_count"),
  uniqueRedeemer: integer("unique_redeemer"),
  uniqueRedeemerSuccess: integer("unique_redeemer_success"),
  totalPointSuccess: bigint("total_point_success", { mode: "number" }),
}).existing();

/**
 * vw_rule_merchant_dim
 * Dimensi rule + merchant + kategori + cluster, termasuk start/end period.
 * DDL dikelola oleh migration_custom.sql — Drizzle tidak akan generate DDL ini.
 */
export const vwRuleMerchantDim = pgView("vw_rule_merchant_dim", {
  ruleKey: uuid("rule_key"),
  merchantKey: uuid("merchant_key"),
  pointRedeem: integer("point_redeem"),
  period: daterange("period"),
  startPeriod: date("start_period", { mode: "string" }),
  endPeriod: date("end_period", { mode: "string" }),
  merchantName: varchar("merchant_name", { length: 500 }),
  keywordCode: varchar("keyword_code", { length: 500 }),
  uniqMerchant: varchar("uniq_merchant", { length: 500 }),
  clusterId: bigint("cluster_id", { mode: "number" }),
  categoryId: integer("category_id"),
  category: varchar("category", { length: 500 }),
  branch: varchar("branch", { length: 500 }),
  cluster: varchar("cluster", { length: 500 }),
  region: varchar("region", { length: 500 }),
}).existing();

// ── stg.transactions_clean ─────────────────────
export const stgTransactionsClean = stgSchema.table(
  "transactions_clean",
  {
    id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
    batchId: uuid("batch_id").notNull(),
    rowNum: integer("row_num").notNull(),
    transactionKey: uuid("transaction_key").notNull(),
    transactionAt: timestamp("transaction_at", { mode: "string" }).notNull(),
    keyword: text("keyword").notNull(),
    msisdn: text("msisdn").notNull(),
    qty: integer("qty").notNull(),
    status: text("status").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  },
  (t) => [index("idx_transactions_clean_batch").on(t.batchId, t.rowNum)],
);
