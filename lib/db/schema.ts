import {
  pgEnum,
  pgTable,
  uuid,
  integer,
  date,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"

export const transactionStatus = pgEnum("transaction_status", [
  "success",
  "failed",
])

export const dimRule = pgTable(
  "dim_rule",
  {
    ruleKey: uuid("rule_key").primaryKey(),
    ruleMerchant: uuid("rule_merchant").notNull(),
    pointRedeem: integer("point_redeem").notNull(),
    startPeriod: date("start_period").notNull(),
    endPeriod: date("end_period").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull(),
  },
  (table) => ({
    ruleMerchantPeriodIndex: {
      name: "dim_rule_index_3",
      columns: [table.ruleMerchant, table.startPeriod, table.endPeriod],
    },
    rulePeriodIndex: {
      name: "dim_rule_period",
      columns: [table.startPeriod, table.endPeriod],
    },
  })
)

export const factTransaction = pgTable(
  "fact_transaction",
  {
    transactionKey: uuid("transaction_key").primaryKey(),
    timestamp: timestamp("timestamp", { mode: "date" }).notNull(),
    uniqMerchantKey: uuid("uniq_merchant_key").notNull(),
    ruleKey: uuid("rule_key").notNull(),
    merchantKey: uuid("merchant_key").notNull(),
    status: transactionStatus("status").notNull(),
    qty: integer("qty").notNull().default(1),
    pointRedeem: integer("point_redeem").notNull(),
    msisdn: varchar("msisdn", { length: 16 }).notNull(),
  },
  (table) => ({
    msisdnIndex: { name: "fact_transaction_index_6", columns: [table.msisdn] },
    merchantIndex: {
      name: "fact_transaction_merchant",
      columns: [table.merchantKey],
    },
    ruleIndex: { name: "fact_transaction_rule", columns: [table.ruleKey] },
    timestampIndex: {
      name: "fact_transaction_timestamp",
      columns: [table.timestamp],
    },
    uniqMerchantIndex: {
      name: "fact_transaction_uniq_merchant",
      columns: [table.uniqMerchantKey],
    },
  })
)

export const dimMerchant = pgTable(
  "dim_merchant",
  {
    merchantKey: uuid("merchant_key").primaryKey(),
    keywordCode: varchar("keyword_code", { length: 500 }).notNull(),
    merchantName: varchar("merchant_name", { length: 500 }).notNull(),
    uniqMerchantKey: uuid("uniq_merchant_key").notNull(),
  },
  (table) => ({
    keywordCodeIndex: {
      name: "dim_merchant_index_3",
      columns: [table.keywordCode],
    },
    uniqMerchantIndex: {
      name: "dim_merchant_merchant",
      columns: [table.uniqMerchantKey],
    },
  })
)

export const category = pgTable("category", {
  categoryId: integer("category_id").primaryKey(),
  category: varchar("category", { length: 500 }).notNull(),
})

export const dimUniqMerchant = pgTable("dim_uniq_merchant", {
  uniqMerchantKey: uuid("uniq_merchant_key").primaryKey(),
  uniqMerchant: varchar("uniq_merchant", { length: 500 }).notNull(),
  region: varchar("region", { length: 500 }).notNull(),
  branch: varchar("branch", { length: 500 }).notNull(),
  categoryId: integer("category_id").notNull(),
})
