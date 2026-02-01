import { relations } from "drizzle-orm/relations";
import { dimUniqMerchant, dimMerchant, factTransaction, dimRule, category } from "./schema";

export const dimMerchantRelations = relations(dimMerchant, ({one, many}) => ({
	dimUniqMerchant: one(dimUniqMerchant, {
		fields: [dimMerchant.uniqMerchantKey],
		references: [dimUniqMerchant.uniqMerchantKey]
	}),
	factTransactions: many(factTransaction),
	dimRules: many(dimRule),
}));

export const dimUniqMerchantRelations = relations(dimUniqMerchant, ({one, many}) => ({
	dimMerchants: many(dimMerchant),
	factTransactions: many(factTransaction),
	category: one(category, {
		fields: [dimUniqMerchant.categoryId],
		references: [category.categoryId]
	}),
}));

export const factTransactionRelations = relations(factTransaction, ({one}) => ({
	dimMerchant: one(dimMerchant, {
		fields: [factTransaction.merchantKey],
		references: [dimMerchant.merchantKey]
	}),
	dimRule: one(dimRule, {
		fields: [factTransaction.ruleKey],
		references: [dimRule.ruleKey]
	}),
	dimUniqMerchant: one(dimUniqMerchant, {
		fields: [factTransaction.uniqMerchantKey],
		references: [dimUniqMerchant.uniqMerchantKey]
	}),
}));

export const dimRuleRelations = relations(dimRule, ({one, many}) => ({
	factTransactions: many(factTransaction),
	dimMerchant: one(dimMerchant, {
		fields: [dimRule.ruleMerchant],
		references: [dimMerchant.merchantKey]
	}),
}));

export const categoryRelations = relations(category, ({many}) => ({
	dimUniqMerchants: many(dimUniqMerchant),
}));