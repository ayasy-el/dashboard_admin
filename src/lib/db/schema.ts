import { pgTable, integer, varchar, index, foreignKey, unique, uuid, bigint, check, date, timestamp, pgEnum, pgView, customType } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const transactionStatus = pgEnum("transaction_status", ['success', 'failed'])
const dateRange = customType<{ data: string; driverData: string }>({
	dataType() {
		return "daterange";
	},
});


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
	period: dateRange("period").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("dim_rule_idx_dim_rule_merchant").using("btree", table.ruleMerchant.asc().nullsLast().op("uuid_ops")),
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
	index("fact_transaction_idx_ft_merchant_status_time").using("btree", table.merchantKey.asc().nullsLast().op("timestamp_ops"), table.status.asc().nullsLast().op("enum_ops"), table.transactionAt.asc().nullsLast().op("enum_ops")),
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
}).existing();

export const vwRuleMerchantDim = pgView("vw_rule_merchant_dim", {
	ruleKey: uuid("rule_key"),
	merchantKey: uuid("merchant_key"),
	pointRedeem: integer("point_redeem"),
	period: dateRange("period"),
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
}).existing();

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
}).existing();
