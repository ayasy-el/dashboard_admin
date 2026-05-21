import { sql } from "drizzle-orm";

import type {
  MerchantAccountDetail,
  MerchantAccountMerchant,
  MerchantAccountSummary,
  MerchantAccountsDashboardData,
  MerchantAccountsRepository,
} from "@/features/merchant-accounts/merchant-accounts.repository";
import { db } from "@/lib/db";

const toBool = (value: unknown) => Boolean(value);
const toInt = (value: unknown) => Number(value ?? 0);

const mapMerchant = (row: Record<string, unknown>): MerchantAccountMerchant => ({
  merchantKey: String(row.merchant_key ?? ""),
  keywordCode: String(row.keyword_code ?? ""),
  merchantName: String(row.merchant_name ?? ""),
  uniqMerchant: String(row.uniq_merchant ?? ""),
  branchName: row.branch_name ? String(row.branch_name) : null,
  categoryName: row.category_name ? String(row.category_name) : null,
  ownerUserId: row.owner_user_id == null ? null : Number(row.owner_user_id),
  ownerEmail: row.owner_email ? String(row.owner_email) : null,
  ownerUsername: row.owner_username ? String(row.owner_username) : null,
  ownerIsActive: toBool(row.owner_is_active),
  canonicalMerchantKey: row.canonical_merchant_key ? String(row.canonical_merchant_key) : null,
  canonicalMerchantName: row.canonical_merchant_name ? String(row.canonical_merchant_name) : null,
});

const resolveSelectedAccountId = (
  accounts: MerchantAccountSummary[],
  requestedId?: number | null,
): number | null => {
  if (requestedId != null && accounts.some((account) => account.id === requestedId)) {
    return requestedId;
  }

  const activeLinked = accounts.find((account) => account.isActive && account.merchantCount > 0);
  if (activeLinked) return activeLinked.id;

  const activeAccount = accounts.find((account) => account.isActive);
  if (activeAccount) return activeAccount.id;

  return accounts[0]?.id ?? null;
};

export class MerchantAccountsRepositoryDrizzle implements MerchantAccountsRepository {
  async getDashboardData(selectedAccountId?: number | null): Promise<MerchantAccountsDashboardData> {
    const accountsResult = await db.execute(sql`
      select
        ua.id as user_id,
        ua.email as email,
        ua.username as username,
        ua.is_active as is_active,
        coalesce(count(distinct dm.merchant_key), 0)::int as merchant_count,
        min(dm.merchant_name) as sample_merchant_name
      from user_accounts ua
      left join dim_merchant dm on dm.user_account_id = ua.id
      group by ua.id, ua.email, ua.username, ua.is_active
      order by ua.is_active desc, ua.email asc, ua.id asc
    `);

    const baseAccounts = accountsResult.rows.map((row) => ({
      id: Number(row.user_id),
      email: String(row.email ?? ""),
      username: row.username ? String(row.username) : null,
      isActive: toBool(row.is_active),
      merchantCount: toInt(row.merchant_count),
      sampleMerchantName: row.sample_merchant_name ? String(row.sample_merchant_name) : null,
    }));

    const enrichedAccounts = baseAccounts.map((account) => ({
      ...account,
    })) satisfies MerchantAccountSummary[];

    const selectedId = resolveSelectedAccountId(enrichedAccounts, selectedAccountId);

    const [selectedMerchantsResult, merchantPoolResult] = await Promise.all([
      selectedId != null
        ? db.execute(sql`
            select
              dm.merchant_key as merchant_key,
              dm.keyword_code as keyword_code,
              dm.merchant_name as merchant_name,
              dm.uniq_merchant as uniq_merchant,
              dc.branch as branch_name,
              dcat.category as category_name,
              dm.user_account_id as owner_user_id,
              ou.email as owner_email,
              ou.username as owner_username,
              ou.is_active as owner_is_active,
              null::uuid as canonical_merchant_key,
              null::text as canonical_merchant_name
            from dim_merchant dm
            left join dim_cluster dc on dc.cluster_id = dm.cluster_id
            left join dim_category dcat on dcat.category_id = dm.category_id
            left join user_accounts ou on ou.id = dm.user_account_id
            where dm.user_account_id = ${selectedId}
            order by dm.merchant_name asc, dm.keyword_code asc
          `)
        : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
      selectedId != null
        ? db.execute(sql`
            select
              dm.merchant_key as merchant_key,
              dm.keyword_code as keyword_code,
              dm.merchant_name as merchant_name,
              dm.uniq_merchant as uniq_merchant,
              dc.branch as branch_name,
              dcat.category as category_name,
              dm.user_account_id as owner_user_id,
              ou.email as owner_email,
              ou.username as owner_username,
              ou.is_active as owner_is_active,
              null::uuid as canonical_merchant_key,
              null::text as canonical_merchant_name
            from dim_merchant dm
            left join user_accounts ou on ou.id = dm.user_account_id
            left join dim_cluster dc on dc.cluster_id = dm.cluster_id
            left join dim_category dcat on dcat.category_id = dm.category_id
            where dm.user_account_id is null or dm.user_account_id <> ${selectedId}
            order by coalesce(ou.email, '') asc, dm.merchant_name asc, dm.keyword_code asc
          `)
        : db.execute(sql`
            select
              dm.merchant_key as merchant_key,
              dm.keyword_code as keyword_code,
              dm.merchant_name as merchant_name,
              dm.uniq_merchant as uniq_merchant,
              dc.branch as branch_name,
              dcat.category as category_name,
              dm.user_account_id as owner_user_id,
              ou.email as owner_email,
              ou.username as owner_username,
              ou.is_active as owner_is_active,
              null::uuid as canonical_merchant_key,
              null::text as canonical_merchant_name
            from dim_merchant dm
            left join user_accounts ou on ou.id = dm.user_account_id
            left join dim_cluster dc on dc.cluster_id = dm.cluster_id
            left join dim_category dcat on dcat.category_id = dm.category_id
            order by coalesce(ou.email, '') asc, dm.merchant_name asc, dm.keyword_code asc
          `),
    ]);

    const selectedMerchants = selectedMerchantsResult.rows.map((row) => mapMerchant(row)) satisfies MerchantAccountMerchant[];
    const merchantPool = merchantPoolResult.rows
      .map((row) => mapMerchant(row))
      .filter((merchant) => merchant.ownerUserId !== selectedId);

    const selectedAccount: MerchantAccountDetail | null = selectedId
      ? (() => {
          const summary = enrichedAccounts.find((account) => account.id === selectedId);
          if (!summary) return null;

          return {
            ...summary,
            merchants: selectedMerchants,
          };
        })()
      : null;

    return {
      accounts: enrichedAccounts,
      selectedAccount,
      merchantPool,
      summary: {
        totalAccounts: enrichedAccounts.length,
        activeAccounts: enrichedAccounts.filter((account) => account.isActive).length,
        inactiveAccounts: enrichedAccounts.filter((account) => !account.isActive).length,
        linkedAccounts: enrichedAccounts.filter((account) => account.merchantCount > 0).length,
        unlinkedAccounts: enrichedAccounts.filter((account) => account.merchantCount === 0).length,
        totalMerchants: merchantPool.length + selectedMerchants.length,
        unconnectedMerchants:
          merchantPool.filter((merchant) => merchant.ownerUserId == null).length +
          selectedMerchants.filter((merchant) => merchant.ownerUserId == null).length,
      },
    };
  }
}
