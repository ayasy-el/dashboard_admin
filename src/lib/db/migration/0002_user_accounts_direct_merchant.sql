do $$
begin
  if to_regclass('public.user_accounts') is null and to_regclass('public.users') is not null then
    alter table public.users rename to user_accounts;
  end if;
end $$;
--> statement-breakpoint
do $$
begin
  alter table public.user_accounts rename constraint users_email_unique to user_accounts_email_unique;
exception
  when undefined_object or duplicate_object then null;
end $$;
--> statement-breakpoint
do $$
begin
  alter table public.user_accounts rename constraint users_username_unique to user_accounts_username_unique;
exception
  when undefined_object or duplicate_object then null;
end $$;
--> statement-breakpoint
alter table public.dim_merchant
  add column if not exists user_account_id bigint;
--> statement-breakpoint
do $$
begin
  if to_regclass('public.merchant_users') is not null then
    update public.dim_merchant dm
    set user_account_id = active_mapping.user_id
    from (
      select distinct on (merchant_key)
        merchant_key,
        user_id
      from public.merchant_users
      where is_active = true
      order by merchant_key, updated_at desc nulls last, created_at desc nulls last
    ) active_mapping
    where dm.merchant_key = active_mapping.merchant_key
      and dm.user_account_id is null;
  end if;
end $$;
--> statement-breakpoint
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dim_merchant_user_account_id_user_accounts_id_fk'
  ) then
    alter table public.dim_merchant
      add constraint dim_merchant_user_account_id_user_accounts_id_fk
      foreign key (user_account_id)
      references public.user_accounts(id)
      on delete set null;
  end if;
end $$;
--> statement-breakpoint
create index if not exists dim_merchant_idx_user_account_id
  on public.dim_merchant using btree (user_account_id);
--> statement-breakpoint
drop table if exists public.merchant_users;
--> statement-breakpoint
drop table if exists public.merchant_canonical_map;
--> statement-breakpoint
drop type if exists public.merchant_scope_type;
--> statement-breakpoint
do $$
begin
  if to_regclass('public.user_accounts') is not null then
    alter table public.user_accounts drop constraint if exists users_role_check;
    alter table public.user_accounts drop column if exists role;
  end if;
end $$;
