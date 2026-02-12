import { db } from '@/lib/db';
import { dimMerchant, dimRule, factTransaction, dimCategory, dimCluster } from '@/lib/db/schema';
import { MerchantData, TransactionData } from '@/lib/csv-utils';
import { and, eq } from 'drizzle-orm';

/**
 * Generate a random UUID (browser-compatible version)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get or create a category ID based on the category name
 */
async function getOrCreateCategory(categoryName: string): Promise<number> {
  // First, try to find an existing category
  const existingCategory = await db
    .select({ categoryId: dimCategory.categoryId })
    .from(dimCategory)
    .where(eq(dimCategory.category, categoryName))
    .limit(1);
  
  if (existingCategory.length > 0) {
    return existingCategory[0].categoryId;
  }
  
  // If not found, create a new category
  const newCategory = await db
    .insert(dimCategory)
    .values({ category: categoryName })
    .returning({ id: dimCategory.categoryId });
  
  return newCategory[0].id;
}

/**
 * Get or create a cluster ID based on the cluster name
 */
async function getOrCreateCluster(clusterName: string, branch: string, region: string): Promise<number> {
  // First, try to find an existing cluster
  const existingCluster = await db
    .select({ clusterId: dimCluster.clusterId })
    .from(dimCluster)
    .where(eq(dimCluster.cluster, clusterName))
    .limit(1);
  
  if (existingCluster.length > 0) {
    return Number(existingCluster[0].clusterId);
  }
  
  // If not found, create a new cluster
  const newCluster = await db
    .insert(dimCluster)
    .values({ 
      cluster: clusterName,
      branch: branch || clusterName,
      region: region || 'Jawa Timur'
    })
    .returning({ id: dimCluster.clusterId });
  
  return Number(newCluster[0].id);
}

/**
 * Insert merchant data into the database
 */
export async function insertMerchants(merchants: MerchantData[]): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let insertedCount = 0;
  
  for (const merchant of merchants) {
    try {
      // Check if merchant with the same keyword_code already exists
      const existingMerchant = await db
        .select()
        .from(dimMerchant)
        .where({ keywordCode: merchant.keyword_code })
        .limit(1);
      
      if (existingMerchant.length > 0) {
        errors.push(`Merchant with keyword code '${merchant.keyword_code}' already exists`);
        continue;
      }
      
      // Get or create category and cluster IDs
      const categoryId = await getOrCreateCategory(merchant.category_name || 'General');
      const clusterId = await getOrCreateCluster(merchant.cluster_name || 'General', merchant.branch_name || 'General', merchant.region_name || 'Jawa Timur');
      
      // Insert the new merchant
      await db.insert(dimMerchant).values({
        merchantKey: generateUUID(), // Generate a new UUID
        keywordCode: merchant.keyword_code,
        merchantName: merchant.merchant_name,
        uniqMerchant: merchant.uniq_merchant,
        clusterId: clusterId,
        categoryId: categoryId,
      });
      
      insertedCount++;
    } catch (error) {
      errors.push(`Failed to insert merchant '${merchant.merchant_name}': ${(error as Error).message}`);
    }
  }
  
  return { inserted: insertedCount, errors };
}

/**
 * Insert transaction data into the database
 */
export async function insertTransactions(transactions: TransactionData[]): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let insertedCount = 0;
  
  for (const transaction of transactions) {
    try {
      // Find the merchant by keyword code since that's what's in the CSV
      const merchant = await db
        .select({ 
          merchantKey: dimMerchant.merchantKey,
          pointRedeem: dimMerchant.pointRedeem // Assuming we store point_redeem in dimMerchant
        })
        .from(dimMerchant)
        .where(eq(dimMerchant.keywordCode, transaction.keyword))
        .limit(1);
      
      if (merchant.length === 0) {
        errors.push(`Merchant with keyword '${transaction.keyword}' does not exist in the database`);
        continue;
      }
      
      // Create a rule if one doesn't exist for this merchant
      let rule = await db
        .select({ ruleKey: dimRule.ruleKey })
        .from(dimRule)
        .where(eq(dimRule.ruleMerchant, merchant[0].merchantKey))
        .limit(1);
      
      let ruleKey = rule.length > 0 ? rule[0].ruleKey : generateUUID();
      
      // If no rule exists, create one
      if (rule.length === 0) {
        await db.insert(dimRule).values({
          ruleKey: ruleKey,
          ruleMerchant: merchant[0].merchantKey,
          pointRedeem: merchant[0].pointRedeem || transaction.point_redeem || 0,
          startPeriod: new Date(transaction.transaction_at).toISOString().split('T')[0], // Convert to date string
          endPeriod: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 year from now
          createdAt: new Date().toISOString(),
        });
      }
      
      // Insert the new transaction
      await db.insert(factTransaction).values({
        transactionKey: generateUUID(), // Generate a new UUID
        transactionAt: transaction.transaction_at,
        ruleKey: ruleKey,
        merchantKey: merchant[0].merchantKey,
        status: transaction.status,
        qty: transaction.qty,
        pointRedeem: merchant[0].pointRedeem || transaction.point_redeem || 0,
        msisdn: transaction.msisdn,
        createdAt: new Date().toISOString(),
      });
      
      insertedCount++;
    } catch (error) {
      errors.push(`Failed to insert transaction for MSISDN '${transaction.msisdn}': ${(error as Error).message}`);
    }
  }
  
  return { inserted: insertedCount, errors };
}