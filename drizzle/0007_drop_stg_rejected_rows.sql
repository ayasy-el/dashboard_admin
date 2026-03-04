alter table audit.batch_issue_links
  add column if not exists dataset text,
  add column if not exists error_type text,
  add column if not exists error_message text,
  add column if not exists raw_payload jsonb;
--> statement-breakpoint

update audit.batch_issue_links bil
set
  dataset = rr.dataset,
  error_type = rr.error_type,
  error_message = rr.error_message,
  raw_payload = rr.raw_payload
from stg.rejected_rows rr
where bil.batch_id = rr.batch_id
  and bil.rejected_row_id = rr.id
  and (bil.dataset is null or bil.error_type is null or bil.error_message is null or bil.raw_payload is null);
--> statement-breakpoint

alter table audit.batch_issue_links
  alter column dataset set not null,
  alter column error_type set not null,
  alter column error_message set not null,
  alter column raw_payload set not null;
--> statement-breakpoint

drop index if exists ux_batch_issue_links_batch_rejected;
--> statement-breakpoint

alter table audit.batch_issue_links
  drop column if exists rejected_row_id;
--> statement-breakpoint

create unique index if not exists ux_batch_issue_links_batch_row_issue
  on audit.batch_issue_links (batch_id, row_num, issue_id);
--> statement-breakpoint

drop table if exists stg.rejected_rows;
