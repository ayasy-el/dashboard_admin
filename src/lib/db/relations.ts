import { relations } from "drizzle-orm/relations";
import {
  dimCategory,
  dimMerchant,
  dimCluster,
  factTransaction,
  adminUsers,
  adminSessions,
  userAccounts,
  merchantFeedback,
} from "./schema";

export const dimCategoryRelations = relations(dimCategory, ({ many }) => ({
  dimMerchants: many(dimMerchant),
}));

export const dimClusterRelations = relations(dimCluster, ({ many }) => ({
  dimMerchants: many(dimMerchant),
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
  factTransactions: many(factTransaction),
  userAccount: one(userAccounts, {
    fields: [dimMerchant.userAccountId],
    references: [userAccounts.id],
  }),
}));

export const factTransactionRelations = relations(factTransaction, ({ one }) => ({
  dimMerchant: one(dimMerchant, {
    fields: [factTransaction.merchantKey],
    references: [dimMerchant.merchantKey],
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

export const userAccountsRelations = relations(userAccounts, ({ many }) => ({
  merchantFeedbacks: many(merchantFeedback),
  dimMerchants: many(dimMerchant),
}));

export const merchantFeedbackRelations = relations(merchantFeedback, ({ one }) => ({
  userAccount: one(userAccounts, {
    fields: [merchantFeedback.userId],
    references: [userAccounts.id],
  }),
}));
