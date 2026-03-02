create or replace view vw_overview_transaction as
select
  ft.transaction_key,
  ft.transaction_at,
  ft.status,
  ft.merchant_key,
  ft.qty,
  ft.point_redeem,
  (ft.qty * ft.point_redeem)::bigint as total_point,
  ft.msisdn,
  dm.keyword_code,
  dm.merchant_name,
  dm.uniq_merchant,
  dcat.category_id,
  dcat.category,
  dcl.cluster_id,
  dcl.cluster,
  dcl.branch,
  dcl.region
from fact_transaction ft
join dim_merchant dm on dm.merchant_key = ft.merchant_key
join dim_category dcat on dcat.category_id = dm.category_id
join dim_cluster dcl on dcl.cluster_id = dm.cluster_id;
