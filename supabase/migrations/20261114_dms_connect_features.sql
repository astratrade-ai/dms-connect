-- DMS Connect feature migration. Safe to re-run.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$ select exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=(select auth.uid())); $$;
revoke all on function private.is_conversation_member(uuid) from public;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create table if not exists public.call_sessions(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 caller_id uuid not null references auth.users(id) on delete cascade,
 callee_id uuid not null references auth.users(id) on delete cascade,
 call_type text not null check(call_type in('audio','video')),
 status text not null default 'ringing' check(status in('ringing','accepted','rejected','ended','missed')),
 created_at timestamptz not null default now(), ended_at timestamptz,
 check(caller_id<>callee_id)
);
create table if not exists public.call_signals(
 id bigint generated always as identity primary key,
 call_id uuid not null references public.call_sessions(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 signal_type text not null check(signal_type in('offer','answer','ice','hangup','reject')),
 payload jsonb not null, created_at timestamptz not null default now()
);
alter table public.call_sessions enable row level security;
alter table public.call_signals enable row level security;
grant select,insert,update on public.call_sessions to authenticated;
grant select,insert on public.call_signals to authenticated;

drop policy if exists "participants read calls" on public.call_sessions;
create policy "participants read calls" on public.call_sessions for select to authenticated
using((select auth.uid()) in(caller_id,callee_id) and private.is_conversation_member(conversation_id));
drop policy if exists "members initiate calls" on public.call_sessions;
create policy "members initiate calls" on public.call_sessions for insert to authenticated
with check(caller_id=(select auth.uid()) and private.is_conversation_member(conversation_id)
 and exists(select 1 from public.conversation_members cm where cm.conversation_id=call_sessions.conversation_id and cm.user_id=callee_id));
drop policy if exists "participants update calls" on public.call_sessions;
create policy "participants update calls" on public.call_sessions for update to authenticated
using((select auth.uid()) in(caller_id,callee_id)) with check((select auth.uid()) in(caller_id,callee_id));
drop policy if exists "participants read call signals" on public.call_signals;
create policy "participants read call signals" on public.call_signals for select to authenticated
using((select auth.uid()) in(sender_id,recipient_id));
drop policy if exists "participants send call signals" on public.call_signals;
create policy "participants send call signals" on public.call_signals for insert to authenticated
with check(sender_id=(select auth.uid()) and exists(
 select 1 from public.call_sessions cs where cs.id=call_signals.call_id
 and (cs.caller_id=(select auth.uid()) or cs.callee_id=(select auth.uid()))
 and call_signals.recipient_id in(cs.caller_id,cs.callee_id)
));

create or replace function public.create_direct_conversation(p_username text)
returns uuid language plpgsql security invoker set search_path=public,auth
as $$
declare target_id uuid; current_id uuid:=auth.uid(); conv_id uuid;
begin
 if current_id is null then raise exception 'Authentication required'; end if;
 select id into target_id from public.profiles where lower(username)=lower(trim(p_username));
 if target_id is null then raise exception 'User not found'; end if;
 if target_id=current_id then raise exception 'Cannot chat with yourself'; end if;
 select c.id into conv_id from public.conversations c where c.kind='direct'
 and exists(select 1 from public.conversation_members a where a.conversation_id=c.id and a.user_id=current_id)
 and exists(select 1 from public.conversation_members b where b.conversation_id=c.id and b.user_id=target_id) limit 1;
 if conv_id is not null then return conv_id; end if;
 insert into public.conversations(kind,created_by) values('direct',current_id) returning id into conv_id;
 insert into public.conversation_members(conversation_id,user_id,member_role) values(conv_id,current_id,'owner');
 insert into public.conversation_members(conversation_id,user_id,member_role) values(conv_id,target_id,'member');
 return conv_id;
end $$;
revoke all on function public.create_direct_conversation(text) from public,anon;
grant execute on function public.create_direct_conversation(text) to authenticated;

create or replace function public.add_conversation_member(p_conversation_id uuid,p_username text)
returns uuid language plpgsql security invoker set search_path=public,auth
as $$
declare target_id uuid; kind_value text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=auth.uid() and member_role in('owner','admin')) then raise exception 'Only group admins can add members'; end if;
 select kind into kind_value from public.conversations where id=p_conversation_id;
 if kind_value<>'group' then raise exception 'Only groups support invites'; end if;
 select id into target_id from public.profiles where lower(username)=lower(trim(p_username));
 if target_id is null then raise exception 'User not found'; end if;
 insert into public.conversation_members(conversation_id,user_id,member_role) values(p_conversation_id,target_id,'member') on conflict do nothing;
 return target_id;
end $$;
revoke all on function public.add_conversation_member(uuid,text) from public,anon;
grant execute on function public.add_conversation_member(uuid,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dms-attachments','dms-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "DMS members upload attachments" on storage.objects;
drop policy if exists "DMS members read attachments" on storage.objects;
drop policy if exists "DMS members delete own attachments" on storage.objects;
create policy "DMS members upload attachments" on storage.objects for insert to authenticated
with check(bucket_id='dms-attachments' and (storage.foldername(name))[2]=(select auth.uid())::text
 and private.is_conversation_member(((storage.foldername(name))[1])::uuid));
create policy "DMS members read attachments" on storage.objects for select to authenticated
using(bucket_id='dms-attachments' and private.is_conversation_member(((storage.foldername(name))[1])::uuid));
create policy "DMS members delete own attachments" on storage.objects for delete to authenticated
using(bucket_id='dms-attachments' and (storage.foldername(name))[2]=(select auth.uid())::text
 and private.is_conversation_member(((storage.foldername(name))[1])::uuid));

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='call_sessions') then alter publication supabase_realtime add table public.call_sessions; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='call_signals') then alter publication supabase_realtime add table public.call_signals; end if;
 end if;
end $$;

-- Private Web Push subscriptions; one user may register several devices.
create table if not exists public.push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 subscription jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions for all to authenticated
using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

-- Harden creator/admin membership checks with fully-qualified outer-row references.
create or replace function private.is_conversation_admin(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
 select exists(select 1 from public.conversation_members cm
   where cm.conversation_id=p_conversation_id
     and cm.user_id=(select auth.uid())
     and cm.member_role in ('owner','admin'));
$$;
revoke all on function private.is_conversation_admin(uuid) from public,anon;
grant execute on function private.is_conversation_admin(uuid) to authenticated;

drop policy if exists "conversation creator adds members" on public.conversation_members;
create policy "conversation creator adds members" on public.conversation_members
for insert to authenticated
with check (
 exists(select 1 from public.conversations c
   where c.id=conversation_members.conversation_id and c.created_by=(select auth.uid()))
 or private.is_conversation_admin(conversation_members.conversation_id)
);

drop policy if exists "members initiate calls" on public.call_sessions;
create policy "members initiate calls" on public.call_sessions
for insert to authenticated
with check (
 call_sessions.caller_id=(select auth.uid())
 and private.is_conversation_member(call_sessions.conversation_id)
 and exists(select 1 from public.conversation_members cm
   where cm.conversation_id=call_sessions.conversation_id
     and cm.user_id=call_sessions.callee_id)
);

drop policy if exists "users create own receipts" on public.conversation_reads;
create policy "users create own receipts" on public.conversation_reads
for insert to authenticated
with check (
 conversation_reads.user_id=(select auth.uid())
 and private.is_conversation_member(conversation_reads.conversation_id)
);
