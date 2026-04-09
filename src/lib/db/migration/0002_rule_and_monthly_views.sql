create or replace view vw_rule_merchant_dim as
select
  dr.rule_key,
  dr.rule_merchant as merchant_key,
  dr.point_redeem,
  dr.start_period,
  dr.end_period,
  dm.merchant_name,
  dm.keyword_code,
  dm.uniq_merchant,
  dm.cluster_id,
  dm.category_id,
  dcat.category,
  dcl.branch,
  dcl.cluster,
  dcl.region
from dim_rule dr
join dim_merchant dm on dm.merchant_key = dr.rule_merchant
join dim_category dcat on dcat.category_id = dm.category_id
join dim_cluster dcl on dcl.cluster_id = dm.cluster_id;

create or replace view vw_merchant_tx_monthly_agg as
select
  date_trunc('month', vt.transaction_at)::date as month_year,
  vt.merchant_key,
  vt.category,
  vt.branch,
  vt.cluster,
  vt.uniq_merchant,
  count(*)::int as tx_count,
  count(*) filter (where vt.status = 'success')::int as success_tx_count,
  count(*) filter (where vt.status = 'failed')::int as failed_tx_count,
  count(distinct vt.msisdn)::int as unique_redeemer,
  count(distinct vt.msisdn) filter (where vt.status = 'success')::int as unique_redeemer_success,
  coalesce(sum(vt.total_point) filter (where vt.status = 'success'), 0)::bigint as total_point_success
from vw_overview_transaction vt
group by
  date_trunc('month', vt.transaction_at)::date,
  vt.merchant_key,
  vt.category,
  vt.branch,
  vt.cluster,
  vt.uniq_merchant;
