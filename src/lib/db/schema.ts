import { pgTable, integer, varchar, index, foreignKey, unique, uuid, bigint, date, check, timestamp, text, boolean, pgView, pgEnum, customType, pgSchema, numeric, bigserial, jsonb, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const merchantScopeType = pgEnum("merchant_scope_type", ['merchant', 'canonical'])
export const transactionStatus = pgEnum("transaction_status", ['success', 'failed'])

const daterange = customType<{ data: string; driverData: string }>({
	dataType() {
		return "daterange";
	},
})


export const dimCategory = pgTable("dim_category", {
	categoryId: integer("category_id").primaryKey().notNull(),
	category: varchar({ length: 500 }).notNull(),
});

export const dimMerchant = pgTable("dim_merchant", {
	merchantKey: uuid("merchant_key").primaryKey().notNull(),
	keywordCode: varchar("keyword_code", { length: 500 }).notNull(),
	merchantName: varchar("merchant_name", { length: 500 }).notNull(),
	uniqMerchant: varchar("uniq_merchant", { length: 500 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clusterId: bigint("cluster_id", { mode: "number" }).notNull(),
	categoryId: integer("category_id").notNull(),
}, (table) => [
	index("dim_merchant_idx_dim_merchant_category_id").using("btree", table.categoryId.asc().nullsLast().op("int4_ops")),
	index("dim_merchant_idx_dim_merchant_cluster_id").using("btree", table.clusterId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [dimCategory.categoryId],
			name: "fk_dim_merchant_category_id_dim_category_category_id"
		}),
	foreignKey({
			columns: [table.clusterId],
			foreignColumns: [dimCluster.clusterId],
			name: "fk_dim_merchant_cluster_id_dim_cluster_cluster_id"
		}),
	unique("dim_merchant_keyword_code_key").on(table.keywordCode),
]);

export const dimRule = pgTable("dim_rule", {
	ruleKey: uuid("rule_key").primaryKey().notNull(),
	ruleMerchant: uuid("rule_merchant").notNull(),
	pointRedeem: integer("point_redeem").notNull(),
	period: daterange("period").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("dim_rule_idx_dim_rule_merchant").using("btree", table.ruleMerchant.asc().nullsLast().op("uuid_ops")),
	index("dim_rule_idx_dim_rule_period").using("gist", table.period.asc().nullsLast().op("range_ops")),
	foreignKey({
			columns: [table.ruleMerchant],
			foreignColumns: [dimMerchant.merchantKey],
			name: "fk_dim_rule_rule_merchant_dim_merchant_merchant_key"
		}),
	check("ck_dim_rule_period_valid", sql`not isempty(period)`),
	check("ck_dim_rule_point_positive", sql`point_redeem >= 0`),
]);

export const factTransaction = pgTable("fact_transaction", {
	transactionKey: uuid("transaction_key").primaryKey().notNull(),
	transactionAt: timestamp("transaction_at", { mode: 'string' }).notNull(),
	ruleKey: uuid("rule_key").notNull(),
	merchantKey: uuid("merchant_key").notNull(),
	status: transactionStatus().notNull(),
	qty: integer().default(1).notNull(),
	pointRedeem: integer("point_redeem").notNull(),
	msisdn: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("fact_transaction_idx_ft_merchant_status_time").using("btree", table.merchantKey.asc().nullsLast().op("timestamp_ops"), table.status.asc().nullsLast().op("timestamp_ops"), table.transactionAt.asc().nullsLast().op("uuid_ops")),
	index("fact_transaction_index_6").using("btree", table.msisdn.asc().nullsLast().op("text_ops")),
	index("fact_transaction_rule").using("btree", table.ruleKey.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.merchantKey],
			foreignColumns: [dimMerchant.merchantKey],
			name: "fk_fact_transaction_merchant_key_dim_merchant_merchant_key"
		}),
	foreignKey({
			columns: [table.ruleKey],
			foreignColumns: [dimRule.ruleKey],
			name: "fk_fact_transaction_rule_key_dim_rule_rule_key"
		}),
	check("ck_fact_transaction_qty_valid", sql`qty >= 1`),
	check("ck_fact_transaction_point_positive", sql`point_redeem >= 0`),
	check("ck_fact_transaction_msisdn_digits", sql`(msisdn)::text ~ '^[0-9]{8,20}$'::text`),
]);


export const dimCluster = pgTable("dim_cluster", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clusterId: bigint("cluster_id", { mode: "number" }).primaryKey().notNull(),
	cluster: varchar({ length: 500 }).notNull(),
	branch: varchar({ length: 500 }).notNull(),
	region: varchar({ length: 500 }).notNull(),
});

export const factClusterPoint = pgTable("fact_cluster_point", {
	pointKey: uuid("point_key").primaryKey().notNull(),
	monthYear: date("month_year").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	clusterId: bigint("cluster_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPoint: bigint("total_point", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	pointOwner: bigint("point_owner", { mode: "number" }).notNull(),
}, (table) => [
	index("fact_cluster_point_idx_fcp_month_cluster").using("btree", table.monthYear.asc().nullsLast().op("date_ops"), table.clusterId.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.clusterId],
			foreignColumns: [dimCluster.clusterId],
			name: "fk_fact_cluster_point_cluster_id_dim_cluster_cluster_id"
		}),
]);

const auditSchema = pgSchema("audit");
const stgSchema = pgSchema("stg");

export const auditBatches = auditSchema.table("batches", {
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
}, (table) => [
	index("idx_batches_dataset_status").on(table.dataset, table.status),
	index("idx_batches_created_at").on(table.createdAt),
]);

export const stgRejectedRows = stgSchema.table("rejected_rows", {
	id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	dataset: text("dataset").notNull(),
	rowNum: integer("row_num").notNull(),
	errorType: text("error_type").notNull(),
	errorMessage: text("error_message").notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_rejected_batch").on(table.batchId, table.rowNum),
]);

export const adminUsers = pgTable("admin_users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: varchar({ length: 320 }).notNull(),
	fullName: varchar("full_name", { length: 120 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("admin_users_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	unique("admin_users_email_unique").on(table.email),
]);

export const adminSessions = pgTable("admin_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	sessionTokenHash: text("session_token_hash").notNull(),
	ipAddress: varchar("ip_address", { length: 64 }),
	userAgent: text("user_agent"),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("admin_sessions_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("admin_sessions_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [adminUsers.id],
			name: "admin_sessions_user_id_admin_users_id_fk"
		}).onDelete("cascade"),
	unique("admin_sessions_token_hash_unique").on(table.sessionTokenHash),
]);

export const merchantCanonicalMap = pgTable("merchant_canonical_map", {
	merchantKey: uuid("merchant_key").primaryKey().notNull(),
	canonicalMerchantKey: uuid("canonical_merchant_key").notNull(),
	uniqMerchant: text("uniq_merchant").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const providerBanners = pgTable("provider_banners", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "provider_banners_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	imageKey: text("image_key").notNull(),
	title: text().notNull(),
	subtitle: text().notNull(),
	cta: text().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_provider_banners_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("idx_provider_banners_sort").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
]);

export const users = pgTable("users", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "users_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	email: text().notNull(),
	username: text(),
	passwordHash: text("password_hash").notNull(),
	role: text().default('merchant').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_username_unique").on(table.username),
	check("users_role_check", sql`role = ANY (ARRAY['merchant'::text, 'admin'::text])`),
]);

export const merchantFeedback = pgTable("merchant_feedback", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity({ name: "merchant_feedback_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	merchantKey: uuid("merchant_key").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	type: text().notNull(),
	category: text().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	status: text().default('open').notNull(),
	reply: text(),
	repliedAt: timestamp("replied_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_merchant_feedback_merchant").using("btree", table.merchantKey.asc().nullsLast().op("uuid_ops")),
	index("idx_merchant_feedback_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_merchant_feedback_user").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "merchant_feedback_user_id_users_id_fk"
		}).onDelete("cascade"),
	check("merchant_feedback_type_check", sql`type = ANY (ARRAY['report'::text, 'critic'::text, 'suggestion'::text])`),
	check("merchant_feedback_status_check", sql`status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text])`),
]);

export const merchantUsers = pgTable("merchant_users", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).primaryKey().notNull(),
	merchantKey: uuid("merchant_key").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	scopeType: merchantScopeType("scope_type").default('merchant').notNull(),
}, (table) => [
	index("idx_merchant_users_merchant_key").using("btree", table.merchantKey.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "merchant_users_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("merchant_users_user_id_merchant_key_unique").on(table.userId, table.merchantKey),
]);


export const stgListKotaRaw = stgSchema.table("list_kota_raw", {
	id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	rowNum: integer("row_num").notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_list_kota_raw_batch").on(table.batchId, table.rowNum),
]);

export const stgMasterRaw = stgSchema.table("master_raw", {
	id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	rowNum: integer("row_num").notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_master_raw_batch").on(table.batchId, table.rowNum),
]);

export const stgTransactionsRaw = stgSchema.table("transactions_raw", {
	id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	rowNum: integer("row_num").notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_transactions_raw_batch").on(table.batchId, table.rowNum),
]);

export const stgTotalPointRaw = stgSchema.table("total_point_raw", {
	id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	rowNum: integer("row_num").notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_total_point_raw_batch").on(table.batchId, table.rowNum),
]);

export const stgListKotaClean = stgSchema.table("list_kota_clean", {
	id: bigserial("id", { mode: "number" }).primaryKey().notNull(),
	batchId: uuid("batch_id").notNull(),
	rowNum: integer("row_num").notNull(),
	region: text("region").notNull(),
	branch: text("branch").notNull(),
	cluster: text("cluster").notNull(),
	clusterId: bigint("cluster_id", { mode: "number" }).notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
}, (table) => [
	index("idx_list_kota_clean_batch").on(table.batchId, table.rowNum),
]);

export const stgMasterClean = stgSchema.table("master_clean", {
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
}, (table) => [
	index("idx_master_clean_batch").on(table.batchId, table.rowNum),
]);

export const stgTransactionsClean = stgSchema.table("transactions_clean", {
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
}, (table) => [
	index("idx_transactions_clean_batch").on(table.batchId, table.rowNum),
]);

export const stgTotalPointClean = stgSchema.table("total_point_clean", {
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
}, (table) => [
	index("idx_total_point_clean_batch").on(table.batchId, table.rowNum),
	uniqueIndex("total_point_clean_batch_row_month_unique").on(table.batchId, table.rowNum, table.monthYear),
]);

export const vwOverviewTransaction = pgView("vw_overview_transaction", {
	transactionKey: uuid("transaction_key"),
	transactionAt: timestamp("transaction_at", { mode: "string" }),
	status: transactionStatus("status"),
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
}).as(sql`SELECT ft.transaction_key, ft.transaction_at, ft.status, ft.merchant_key, ft.qty, ft.point_redeem, (ft.qty * ft.point_redeem)::bigint AS total_point, ft.msisdn, dm.keyword_code, dm.merchant_name, dm.uniq_merchant, dcat.category_id, dcat.category, dcl.cluster_id, dcl.cluster, dcl.branch, dcl.region FROM fact_transaction ft JOIN dim_merchant dm ON dm.merchant_key = ft.merchant_key JOIN dim_category dcat ON dcat.category_id = dm.category_id JOIN dim_cluster dcl ON dcl.cluster_id = dm.cluster_id`);

export const vwRuleMerchantDim = pgView("vw_rule_merchant_dim", {	
	ruleKey: uuid("rule_key"),
	merchantKey: uuid("merchant_key"),
	pointRedeem: integer("point_redeem"),
	period: daterange("period"),
	startPeriod: date("start_period"),
	endPeriod: date("end_period"),
	merchantName: varchar("merchant_name", { length: 500 }),
	keywordCode: varchar("keyword_code", { length: 500 }),
	uniqMerchant: varchar("uniq_merchant", { length: 500 }),
	clusterId: bigint("cluster_id", { mode: "number" }),
	categoryId: integer("category_id"),
	category: varchar("category", { length: 500 }),
	branch: varchar("branch", { length: 500 }),
	cluster: varchar("cluster", { length: 500 }),
	region: varchar("region", { length: 500 }),
}).as(sql`SELECT dr.rule_key, dr.rule_merchant AS merchant_key, dr.point_redeem, dr.period, lower(dr.period) AS start_period, (upper(dr.period) - '1 day'::interval)::date AS end_period, dm.merchant_name, dm.keyword_code, dm.uniq_merchant, dm.cluster_id, dm.category_id, dcat.category, dcl.branch, dcl.cluster, dcl.region FROM dim_rule dr JOIN dim_merchant dm ON dm.merchant_key = dr.rule_merchant JOIN dim_category dcat ON dcat.category_id = dm.category_id JOIN dim_cluster dcl ON dcl.cluster_id = dm.cluster_id`);

export const vwMerchantTxMonthlyAgg = pgView("vw_merchant_tx_monthly_agg", {	
	monthYear: date("month_year"),
	merchantKey: uuid("merchant_key"),
	category: varchar("category", { length: 500 }),
	branch: varchar("branch", { length: 500 }),
	cluster: varchar("cluster", { length: 500 }),
	uniqMerchant: varchar("uniq_merchant", { length: 500 }),
	txCount: integer("tx_count"),
	successTxCount: integer("success_tx_count"),
	failedTxCount: integer("failed_tx_count"),
	uniqueRedeemer: integer("unique_redeemer"),
	uniqueRedeemerSuccess: integer("unique_redeemer_success"),
	totalPointSuccess: bigint("total_point_success", { mode: "number" }),
}).as(sql`SELECT date_trunc('month'::text, transaction_at)::date AS month_year, merchant_key, category, branch, cluster, uniq_merchant, count(*)::integer AS tx_count, count(*) FILTER (WHERE status = 'success'::transaction_status)::integer AS success_tx_count, count(*) FILTER (WHERE status = 'failed'::transaction_status)::integer AS failed_tx_count, count(DISTINCT msisdn)::integer AS unique_redeemer, count(DISTINCT msisdn) FILTER (WHERE status = 'success'::transaction_status)::integer AS unique_redeemer_success, COALESCE(sum(total_point) FILTER (WHERE status = 'success'::transaction_status), 0::numeric)::bigint AS total_point_success FROM vw_overview_transaction vt GROUP BY (date_trunc('month'::text, transaction_at)::date), merchant_key, category, branch, cluster, uniq_merchant`);
