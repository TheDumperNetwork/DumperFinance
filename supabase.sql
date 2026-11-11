-- Run this once in Supabase: SQL Editor > New query > paste > Run.
create table vaults(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid not null references auth.users(id) default auth.uid(),
  code text unique not null default substr(md5(random()::text||clock_timestamp()::text),1,8),
  data jsonb not null default '{}',
  updated_at timestamptz not null default now());
create table members(
  vault_id uuid references vaults(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  primary key(vault_id,user_id));
alter table vaults enable row level security;
alter table members enable row level security;
create function is_member(v uuid) returns boolean language sql security definer set search_path=public stable
  as $$ select exists(select 1 from members where vault_id=v and user_id=auth.uid()) $$;
create policy "read" on vaults for select using (owner=auth.uid() or is_member(id));
create policy "insert" on vaults for insert with check (owner=auth.uid());
create policy "update" on vaults for update using (owner=auth.uid() or is_member(id));
create policy "delete" on vaults for delete using (owner=auth.uid());
create policy "own rows" on members for select using (user_id=auth.uid());
create function add_owner() returns trigger language plpgsql security definer set search_path=public
  as $$ begin insert into members values (new.id,new.owner); return new; end $$;
create trigger vault_owner after insert on vaults for each row execute function add_owner();
create function join_vault(c text) returns uuid language plpgsql security definer set search_path=public
  as $$ declare v uuid; begin
    select id into v from vaults where code=c;
    if v is null then raise exception 'Invalid code'; end if;
    insert into members values (v,auth.uid()) on conflict do nothing;
    return v; end $$;
alter publication supabase_realtime add table vaults;
