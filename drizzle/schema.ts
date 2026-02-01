import { pgTable, index, foreignKey, unique, uuid, varchar, timestamp, integer, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const transactionStatus = pgEnum("transaction_status", ['success', 'failed'])


export const dimMerchant = pgTable("dim_merchant", {
	merchantKey: uuid("merchant_key").primaryKey().notNull(),
	keywordCode: varchar("keyword_code", { length: 500 }).notNull(),
	merchantName: varchar("merchant_name", { length: 500 }).notNull(),
	uniqMerchantKey: uuid("uniq_merchant_key").notNull(),
}, (table) => [
	index("dim_merchant_index_3").using("btree", table.keywordCode.asc().nullsLast().op("text_ops")),
	index("dim_merchant_merchant").using("btree", table.uniqMerchantKey.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.uniqMerchantKey],
			foreignColumns: [dimUniqMerchant.uniqMerchantKey],
			name: "fk_dim_merchant_uniq_merchant_key_dim_uniq_merchant_uniq_mer"
		}),
	unique("dim_merchant_keyword_code_key").on(table.keywordCode),
]);

export const factTransaction = pgTable("fact_transaction", {
	transactionKey: uuid("transaction_key").primaryKey().notNull(),
	timestamp: timestamp({ mode: 'string' }).notNull(),
	uniqMerchantKey: uuid("uniq_merchant_key").notNull(),
	ruleKey: uuid("rule_key").notNull(),
	merchantKey: uuid("merchant_key").notNull(),
	status: transactionStatus().notNull(),
	qty: integer().default(1).notNull(),
	pointRedeem: integer("point_redeem").notNull(),
	msisdn: varchar({ length: 16 }).notNull(),
}, (table) => [
	index("fact_transaction_index_6").using("btree", table.msisdn.asc().nullsLast().op("text_ops")),
	index("fact_transaction_merchant").using("btree", table.merchantKey.asc().nullsLast().op("uuid_ops")),
	index("fact_transaction_rule").using("btree", table.ruleKey.asc().nullsLast().op("uuid_ops")),
	index("fact_transaction_timestamp").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	index("fact_transaction_uniq_merchant").using("btree", table.uniqMerchantKey.asc().nullsLast().op("uuid_ops")),
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
	foreignKey({
			columns: [table.uniqMerchantKey],
			foreignColumns: [dimUniqMerchant.uniqMerchantKey],
			name: "fk_fact_transaction_uniq_merchant_key_dim_uniq_merchant_uniq"
		}),
]);

export const dimRule = pgTable("dim_rule", {
	ruleKey: uuid("rule_key").primaryKey().notNull(),
	ruleMerchant: uuid("rule_merchant").notNull(),
	pointRedeem: integer("point_redeem").notNull(),
	startPeriod: date("start_period").notNull(),
	endPeriod: date("end_period").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	index("dim_rule_index_3").using("btree", table.ruleMerchant.asc().nullsLast().op("date_ops"), table.startPeriod.asc().nullsLast().op("date_ops"), table.endPeriod.asc().nullsLast().op("uuid_ops")),
	index("dim_rule_period").using("btree", table.startPeriod.asc().nullsLast().op("date_ops"), table.endPeriod.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.ruleMerchant],
			foreignColumns: [dimMerchant.merchantKey],
			name: "fk_dim_rule_rule_merchant_dim_merchant_merchant_key"
		}),
]);

export const dimUniqMerchant = pgTable("dim_uniq_merchant", {
	uniqMerchantKey: uuid("uniq_merchant_key").primaryKey().notNull(),
	uniqMerchant: varchar("uniq_merchant", { length: 500 }).notNull(),
	region: varchar({ length: 500 }).notNull(),
	branch: varchar({ length: 500 }).notNull(),
	categoryId: integer("category_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [category.categoryId],
			name: "fk_dim_uniq_merchant_category_id_category_category_id"
		}),
]);

export const category = pgTable("category", {
	categoryId: integer("category_id").primaryKey().notNull(),
	category: varchar({ length: 500 }).notNull(),
});
