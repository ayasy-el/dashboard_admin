import { relations } from "drizzle-orm/relations";
import { dimCategory, dimMerchant, dimCluster, dimRule, factTransaction, factClusterPoint } from "./schema";

export const dimMerchantRelations = relations(dimMerchant, ({one, many}) => ({
	dimCategory: one(dimCategory, {
		fields: [dimMerchant.categoryId],
		references: [dimCategory.categoryId]
	}),
	dimCluster: one(dimCluster, {
		fields: [dimMerchant.clusterId],
		references: [dimCluster.clusterId]
	}),
	dimRules: many(dimRule),
	factTransactions: many(factTransaction),
}));

export const dimCategoryRelations = relations(dimCategory, ({many}) => ({
	dimMerchants: many(dimMerchant),
}));

export const dimClusterRelations = relations(dimCluster, ({many}) => ({
	dimMerchants: many(dimMerchant),
	factClusterPoints: many(factClusterPoint),
}));

export const dimRuleRelations = relations(dimRule, ({one, many}) => ({
	dimMerchant: one(dimMerchant, {
		fields: [dimRule.ruleMerchant],
		references: [dimMerchant.merchantKey]
	}),
	factTransactions: many(factTransaction),
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
}));

export const factClusterPointRelations = relations(factClusterPoint, ({one}) => ({
	dimCluster: one(dimCluster, {
		fields: [factClusterPoint.clusterId],
		references: [dimCluster.clusterId]
	}),
}));