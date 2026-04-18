import { relations } from "drizzle-orm/relations";
import {
  dimCategory,
  dimMerchant,
  dimCluster,
  dimRule,
  factClusterPoint,
  factTransaction,
  adminUsers,
  adminSessions,
  users,
  merchantFeedback,
  merchantUsers,
} from "./schema";

export const dimCategoryRelations = relations(dimCategory, ({ many }) => ({
  dimMerchants: many(dimMerchant),
}));

export const dimClusterRelations = relations(dimCluster, ({ many }) => ({
  dimMerchants: many(dimMerchant),
  factClusterPoints: many(factClusterPoint),
}));

export const dimMerchantRelations = relations(dimMerchant, ({ one, many }) => ({
  dimCategory: one(dimCategory, {
    fields: [dimMerchant.categoryId],
    references: [dimCategory.categoryId],
  }),
  dimCluster: one(dimCluster, {
    fields: [dimMerchant.clusterId],
    references: [dimCluster.clusterId],
  }),
  dimRules: many(dimRule),
  factTransactions: many(factTransaction),
}));

export const dimRuleRelations = relations(dimRule, ({ one, many }) => ({
  dimMerchant: one(dimMerchant, {
    fields: [dimRule.ruleMerchant],
    references: [dimMerchant.merchantKey],
  }),
  factTransactions: many(factTransaction),
}));

export const factClusterPointRelations = relations(factClusterPoint, ({ one }) => ({
  dimCluster: one(dimCluster, {
    fields: [factClusterPoint.clusterId],
    references: [dimCluster.clusterId],
  }),
}));

export const factTransactionRelations = relations(factTransaction, ({ one }) => ({
  dimMerchant: one(dimMerchant, {
    fields: [factTransaction.merchantKey],
    references: [dimMerchant.merchantKey],
  }),
  dimRule: one(dimRule, {
    fields: [factTransaction.ruleKey],
    references: [dimRule.ruleKey],
  }),
}));

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  adminSessions: many(adminSessions),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [adminSessions.userId],
    references: [adminUsers.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  merchantFeedbacks: many(merchantFeedback),
  merchantUsers: many(merchantUsers),
}));

export const merchantFeedbackRelations = relations(merchantFeedback, ({ one }) => ({
  user: one(users, {
    fields: [merchantFeedback.userId],
    references: [users.id],
  }),
}));

export const merchantUsersRelations = relations(merchantUsers, ({ one }) => ({
  user: one(users, {
    fields: [merchantUsers.userId],
    references: [users.id],
  }),
}));
