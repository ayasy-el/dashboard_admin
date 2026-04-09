alter table audit.batches
  add column if not exists batch_public_id text;
--> statement-breakpoint

with numbered as (
  select
    b.batch_id,
    b.dataset,
    to_char(b.created_at, 'YYYYMMDDHH24MISSMS') as ts_key,
    row_number() over (
      partition by b.dataset, to_char(b.created_at, 'YYYYMMDDHH24MISSMS')
      order by b.created_at, b.batch_id
    ) as seq
  from audit.batches b
  where b.batch_public_id is null
)
update audit.batches b
set batch_public_id = numbered.dataset || '-' || numbered.ts_key || '-' || lpad((numbered.seq - 1)::text, 2, '0')
from numbered
where b.batch_id = numbered.batch_id;
--> statement-breakpoint

alter table audit.batches
  alter column batch_public_id set not null;
--> statement-breakpoint

create unique index if not exists ux_batches_public_id
  on audit.batches (batch_public_id);
--> statement-breakpoint
