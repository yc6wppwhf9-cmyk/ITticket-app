-- IT & Ginesys Ticket Desk — complete schema.
--
-- Everything the app needs lives in this one file: tables, the ticket-number
-- generator, the status/timestamp rules, the audit history, in-app
-- notifications, row-level security and the attachment bucket. Run it once on
-- a fresh Supabase project (SQL editor, or `supabase db push`).
--
-- Row-level security is the real access boundary. The web app's own role
-- checks only decide what to show; every rule that matters is enforced here,
-- so a request crafted by hand gets exactly the same answer as the UI.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- requester: anyone in the company; raises and follows their own tickets.
-- agent:     IT / development staff; works every ticket.
-- admin:     IT head; everything an agent can do plus users, masters, reports.
create type public.app_role as enum ('requester', 'agent', 'admin');

create type public.ticket_status as enum
  ('open', 'in_progress', 'pending', 'resolved', 'closed');

create type public.ticket_priority as enum ('high', 'medium', 'low');

-- ---------------------------------------------------------------------------
-- Masters
-- ---------------------------------------------------------------------------

create table public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text,
  phone          text,
  role           public.app_role not null default 'requester',
  department_id  uuid references public.departments (id) on delete set null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.categories (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique check (length(trim(name)) > 0),
  description          text,
  sort_order           int not null default 100,
  -- New tickets in this category go straight to this person, so the common
  -- case ("BOM issues always go to Ravi") needs nobody to triage it.
  default_assignee_id  uuid references public.profiles (id) on delete set null,
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

insert into public.categories (name, description, sort_order) values
  ('Ginesys Issue',               'Errors or unexpected behaviour in Ginesys',            10),
  ('Master Data / Item Master',   'Item, vendor, customer or other master data',          20),
  ('BOM-related Issue',           'Bill of materials creation, changes or errors',        30),
  ('User / Access Issue',         'New user, password reset, rights and permissions',     40),
  ('Report / ERP Requirement',    'New or changed reports and ERP requirements',          50),
  ('System / Technical Issue',    'Hardware, network, email, printer, software',          60),
  ('New Development / Modification', 'New module, customisation or process change',      70),
  ('Other IT Requirement',        'Anything that does not fit the categories above',      80);

-- ---------------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so policies can call them without recursing
-- into the profiles policy; STABLE so Postgres evaluates them once per query.
-- ---------------------------------------------------------------------------

create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_it_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('agent', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- The sign-up form runs before anyone is signed in, so it cannot read the
-- departments table. This exposes just the active names, nothing else.
create or replace function public.signup_departments()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from public.departments where active order by name
$$;
grant execute on function public.signup_departments() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: created automatically on sign-up.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dept uuid;
begin
  -- The department comes from sign-up metadata, which the person typed, so it
  -- is only used if it names a real, active department. The role never comes
  -- from metadata: everyone starts as a requester and an admin promotes them.
  begin
    dept := nullif(new.raw_user_meta_data ->> 'department_id', '')::uuid;
  exception when invalid_text_representation then
    dept := null;
  end;
  if dept is not null and not exists
      (select 1 from public.departments where id = dept and active) then
    dept := null;
  end if;

  insert into public.profiles (id, email, full_name, phone, department_id)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    dept
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- People may edit their own name, phone and department. Role, active flag and
-- email are an admin's to change.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Only an admin can change role, status or email'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

create table public.ticket_counters (
  year  int primary key,
  last  int not null
);

create table public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  ticket_no          text not null unique,
  title              text not null check (length(trim(title)) between 3 and 200),
  description        text not null check (length(trim(description)) > 0),
  category_id        uuid not null references public.categories (id),
  priority           public.ticket_priority not null default 'medium',
  status             public.ticket_status not null default 'open',
  requester_id       uuid not null references public.profiles (id),
  -- The requester's department when the ticket was raised. Copied rather than
  -- joined so that MIS stays true to history when someone changes department.
  department_id      uuid references public.departments (id) on delete set null,
  assignee_id        uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  assigned_at        timestamptz,
  -- First time IT did something visible: moved it out of Open, or replied.
  first_response_at  timestamptz,
  resolved_at        timestamptz,
  closed_at          timestamptz,
  last_activity_at   timestamptz not null default now()
);

create index tickets_requester_idx on public.tickets (requester_id, created_at desc);
create index tickets_assignee_idx  on public.tickets (assignee_id, status);
create index tickets_status_idx    on public.tickets (status, created_at desc);
create index tickets_dept_idx      on public.tickets (department_id, status);

-- Ticket numbers read IT-2026-00001 and restart each calendar year. The
-- counter row is locked by the upsert, so two tickets raised in the same
-- instant can never share a number.
create or replace function public.next_ticket_no(at timestamptz)
returns text
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from at at time zone 'Asia/Kolkata')::int;
  n int;
begin
  insert into public.ticket_counters (year, last) values (y, 1)
  on conflict (year) do update set last = public.ticket_counters.last + 1
  returning last into n;
  return 'IT-' || y || '-' || lpad(n::text, 5, '0');
end;
$$;

create or replace function public.ticket_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cat public.categories%rowtype;
begin
  -- Whatever the client sent, these are the server's to decide.
  new.created_at        := now();
  new.updated_at        := now();
  new.last_activity_at  := now();
  new.status            := 'open';
  new.first_response_at := null;
  new.resolved_at       := null;
  new.closed_at         := null;
  new.ticket_no         := public.next_ticket_no(new.created_at);

  if auth.uid() is not null then
    -- Staff may raise a ticket on someone's behalf (a phone call, say);
    -- everyone else raises tickets as themselves.
    if new.requester_id is null or not public.is_it_staff() then
      new.requester_id := auth.uid();
    end if;
  end if;
  if new.requester_id is null then
    raise exception 'A ticket needs a requester';
  end if;

  select department_id into new.department_id
    from public.profiles where id = new.requester_id;

  select * into cat from public.categories where id = new.category_id;
  if not found or not cat.active then
    raise exception 'Choose an active category';
  end if;

  -- Only IT staff choose an assignee directly; otherwise the category's
  -- default (if any) picks it up.
  if new.assignee_id is not null and auth.uid() is not null
     and not public.is_it_staff() then
    new.assignee_id := null;
  end if;
  if new.assignee_id is null then
    new.assignee_id := cat.default_assignee_id;
  end if;
  if new.assignee_id is not null then
    if not exists (select 1 from public.profiles
                   where id = new.assignee_id and active
                     and role in ('agent', 'admin')) then
      new.assignee_id := null;
    else
      new.assigned_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger tickets_before_insert
  before insert on public.tickets
  for each row execute function public.ticket_before_insert();

create or replace function public.ticket_before_update()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  staff boolean := auth.uid() is null or public.is_it_staff();
begin
  -- Identity and creation facts never change.
  new.id            := old.id;
  new.ticket_no     := old.ticket_no;
  new.requester_id  := old.requester_id;
  new.department_id := old.department_id;
  new.created_at    := old.created_at;

  if not staff then
    -- A requester can only answer a resolution: accept it (close) or say it
    -- isn't fixed (reopen). Everything else is IT's to change.
    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.category_id is distinct from old.category_id
       or new.priority is distinct from old.priority
       or new.assignee_id is distinct from old.assignee_id then
      raise exception 'Only IT staff can change this ticket'
        using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (
         (old.status = 'resolved' and new.status in ('closed', 'open'))
      or (old.status = 'closed'   and new.status = 'open')
    ) then
      raise exception 'You can close a resolved ticket or reopen it; IT changes the rest'
        using errcode = '42501';
    end if;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    if new.assignee_id is not null and not exists (
        select 1 from public.profiles
        where id = new.assignee_id and active and role in ('agent', 'admin')) then
      raise exception 'Tickets can only be assigned to active IT staff';
    end if;
    new.assigned_at := case when new.assignee_id is null then null else now() end;
  end if;

  if new.status is distinct from old.status then
    if new.status <> 'open' and old.first_response_at is null then
      new.first_response_at := now();
    end if;
    if new.status = 'resolved' then
      new.resolved_at := now();
      new.closed_at   := null;
    elsif new.status = 'closed' then
      -- Closing straight from an open state counts as resolving it now.
      new.resolved_at := coalesce(old.resolved_at, now());
      new.closed_at   := now();
    else
      -- Reopened, or moved back into work: the old resolution no longer holds.
      new.resolved_at := null;
      new.closed_at   := null;
    end if;
  else
    new.resolved_at := old.resolved_at;
    new.closed_at   := old.closed_at;
  end if;
  -- Once set, the first response time stands; only IT activity can set it.
  new.first_response_at := coalesce(old.first_response_at,
    case when staff then new.first_response_at end);

  new.updated_at       := now();
  new.last_activity_at := now();
  return new;
end;
$$;

create trigger tickets_before_update
  before update on public.tickets
  for each row execute function public.ticket_before_update();

create or replace function public.can_see_ticket(t uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_it_staff()
      or exists (select 1 from public.tickets
                 where id = t and requester_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Comments, attachments, history, notifications
-- ---------------------------------------------------------------------------

create table public.ticket_comments (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.tickets (id) on delete cascade,
  author_id    uuid not null default auth.uid() references public.profiles (id),
  body         text not null check (length(trim(body)) > 0),
  -- Internal notes are visible to IT staff only.
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);

create table public.ticket_attachments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets (id) on delete cascade,
  comment_id    uuid references public.ticket_comments (id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  size_bytes    bigint,
  mime_type     text,
  uploaded_by   uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  -- The object must sit under the ticket's own folder, which is what the
  -- storage policies check. Without this a row could point at another
  -- ticket's file.
  check (storage_path like ticket_id::text || '/%')
);
create index ticket_attachments_ticket_idx on public.ticket_attachments (ticket_id);

-- The audit trail. Written only by triggers; nobody can insert, edit or
-- delete a row through the API, so it is a faithful history.
create table public.ticket_events (
  id          bigint generated always as identity primary key,
  ticket_id   uuid not null references public.tickets (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete set null,
  event       text not null,   -- created | status | assigned | priority | category | title | description | attachment
  from_value  text,
  to_value    text,
  note        text,
  created_at  timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);

create table public.notifications (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  ticket_id        uuid references public.tickets (id) on delete cascade,
  actor_id         uuid references public.profiles (id) on delete set null,
  kind             text not null,
  message          text not null,
  read_at          timestamptz,
  -- Email outbox: the web app claims rows with emailed_at is null, sends, and
  -- stamps them, so a notification is mailed at most once.
  emailed_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_outbox_idx on public.notifications (ticket_id) where emailed_at is null;

-- Notify each person once, never the person who did the thing, and never
-- someone deactivated.
create or replace function public.notify_users(
  recipients uuid[], t uuid, k text, msg text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, ticket_id, actor_id, kind, message)
  select distinct p.id, t, auth.uid(), k, msg
  from public.profiles p
  where p.id = any (recipients)
    and p.active
    and p.id is distinct from auth.uid();
end;
$$;

create or replace function public.staff_ids(admins_only boolean)
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}')
  from public.profiles
  where active and (role = 'admin' or (not admins_only and role = 'agent'))
$$;

create or replace function public.status_label(s public.ticket_status)
returns text language sql immutable as $$
  select case s
    when 'open' then 'Open'
    when 'in_progress' then 'In Progress'
    when 'pending' then 'Pending'
    when 'resolved' then 'Resolved'
    when 'closed' then 'Closed'
  end
$$;

create or replace function public.person_name(p uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(full_name, split_part(email, '@', 1))
  from public.profiles where id = p
$$;

create or replace function public.ticket_after_write()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  remark text := nullif(trim(current_setting('app.remark', true)), '');
  label text := new.ticket_no || ' · ' || new.title;
  status_note_used boolean := false;
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_events (ticket_id, actor_id, event, to_value)
    values (new.id, actor, 'created', public.status_label(new.status));
    if new.assignee_id is not null then
      insert into public.ticket_events (ticket_id, actor_id, event, to_value)
      values (new.id, actor, 'assigned', public.person_name(new.assignee_id));
    end if;

    -- A new ticket goes to the IT admins and to whoever it landed with; if it
    -- landed with nobody, the whole IT team hears about it.
    perform public.notify_users(
      case when new.assignee_id is null
           then public.staff_ids(false)
           else public.staff_ids(true) || new.assignee_id end,
      new.id, 'created',
      'New ' || new.priority::text || ' priority ticket ' || label ||
      ' raised by ' || coalesce(public.person_name(new.requester_id), 'someone'));
    if actor is distinct from new.requester_id then
      perform public.notify_users(array[new.requester_id], new.id, 'created',
        'A ticket was raised on your behalf: ' || label);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.ticket_events (ticket_id, actor_id, event, from_value, to_value, note)
    values (new.id, actor, 'status', public.status_label(old.status),
            public.status_label(new.status), remark);
    status_note_used := true;
    perform public.notify_users(array[new.requester_id, new.assignee_id],
      new.id, 'status',
      label || ' is now ' || public.status_label(new.status) ||
      coalesce(' — ' || remark, ''));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.ticket_events (ticket_id, actor_id, event, from_value, to_value, note)
    values (new.id, actor, 'assigned', public.person_name(old.assignee_id),
            public.person_name(new.assignee_id),
            case when status_note_used then null else remark end);
    status_note_used := true;
    if new.assignee_id is not null then
      perform public.notify_users(array[new.assignee_id], new.id, 'assigned',
        label || ' has been assigned to you');
      perform public.notify_users(array[new.requester_id], new.id, 'assigned',
        label || ' has been assigned to ' || public.person_name(new.assignee_id));
    end if;
  end if;

  if new.priority is distinct from old.priority then
    insert into public.ticket_events (ticket_id, actor_id, event, from_value, to_value, note)
    values (new.id, actor, 'priority', old.priority::text, new.priority::text,
            case when status_note_used then null else remark end);
    status_note_used := true;
  end if;

  if new.category_id is distinct from old.category_id then
    insert into public.ticket_events (ticket_id, actor_id, event, from_value, to_value, note)
    values (new.id, actor, 'category',
            (select name from public.categories where id = old.category_id),
            (select name from public.categories where id = new.category_id),
            case when status_note_used then null else remark end);
  end if;

  if new.title is distinct from old.title then
    insert into public.ticket_events (ticket_id, actor_id, event, from_value, to_value)
    values (new.id, actor, 'title', old.title, new.title);
  end if;
  if new.description is distinct from old.description then
    insert into public.ticket_events (ticket_id, actor_id, event)
    values (new.id, actor, 'description');
  end if;
  return new;
end;
$$;

create trigger tickets_after_write
  after insert or update on public.tickets
  for each row execute function public.ticket_after_write();

create or replace function public.comment_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t public.tickets%rowtype;
  label text;
  author_is_staff boolean;
begin
  select * into t from public.tickets where id = new.ticket_id;
  label := t.ticket_no || ' · ' || t.title;
  select role in ('agent', 'admin') into author_is_staff
    from public.profiles where id = new.author_id;

  -- A reply from IT is the first response if nothing else was. Done as a
  -- direct column write by the definer, so it doesn't trip the update guard.
  update public.tickets
     set last_activity_at = now(),
         first_response_at = case
           when author_is_staff and first_response_at is null
                and new.author_id is distinct from requester_id
           then now() else first_response_at end
   where id = new.ticket_id;

  if new.is_internal then
    perform public.notify_users(public.staff_ids(true) || t.assignee_id,
      t.id, 'note', 'Internal note on ' || label);
  else
    perform public.notify_users(
      array[t.requester_id, t.assignee_id] ||
        case when t.assignee_id is null then public.staff_ids(true) else '{}'::uuid[] end,
      t.id, 'comment',
      coalesce(public.person_name(new.author_id), 'Someone') ||
      ' commented on ' || label || ': ' || left(new.body, 140));
  end if;
  return new;
end;
$$;

create trigger ticket_comments_after_insert
  after insert on public.ticket_comments
  for each row execute function public.comment_after_insert();

create or replace function public.attachment_after_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Files on a comment are shown with that comment; only files added to the
  -- ticket itself are worth a separate history line.
  if new.comment_id is null then
    insert into public.ticket_events (ticket_id, actor_id, event, to_value)
    values (new.ticket_id, auth.uid(), 'attachment', new.file_name);
  end if;
  return new;
end;
$$;

create trigger ticket_attachments_after_insert
  after insert on public.ticket_attachments
  for each row execute function public.attachment_after_insert();

-- One call for every IT change, so a remark lands on the same history line as
-- the change it explains. SECURITY INVOKER: the caller's own row-level
-- security and the update guard decide what is allowed.
create or replace function public.update_ticket(
  p_ticket_id   uuid,
  p_status      public.ticket_status default null,
  p_assignee_id uuid default null,
  p_unassign    boolean default false,
  p_priority    public.ticket_priority default null,
  p_category_id uuid default null,
  p_remark      text default null
)
returns public.tickets
language plpgsql security invoker set search_path = public as $$
declare
  before public.tickets;
  result public.tickets;
  note   text := nullif(trim(coalesce(p_remark, '')), '');
begin
  select * into before from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'Ticket not found' using errcode = 'P0002';
  end if;

  perform set_config('app.remark', coalesce(note, ''), true);
  update public.tickets set
    status      = coalesce(p_status, status),
    assignee_id = case when p_unassign then null
                       else coalesce(p_assignee_id, assignee_id) end,
    priority    = coalesce(p_priority, priority),
    category_id = coalesce(p_category_id, category_id)
  where id = p_ticket_id
  returning * into result;
  perform set_config('app.remark', '', true);

  -- A remark rides on the history line of the change it explains. With
  -- nothing changed there is no such line, so it is posted as a comment
  -- instead and the requester still sees it.
  if note is not null
     and result.status      is not distinct from before.status
     and result.assignee_id is not distinct from before.assignee_id
     and result.priority    is not distinct from before.priority
     and result.category_id is not distinct from before.category_id then
    insert into public.ticket_comments (ticket_id, body) values (p_ticket_id, note);
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.departments        enable row level security;
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.ticket_counters    enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_comments    enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_events      enable row level security;
alter table public.notifications      enable row level security;

-- Masters: everyone signed in reads them; only admins change them.
create policy departments_read on public.departments
  for select to authenticated using (true);
create policy departments_admin on public.departments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy categories_read on public.categories
  for select to authenticated using (true);
create policy categories_admin on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Names and departments are needed to show who raised and who owns a ticket.
create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ticket_counters: no policies; only the SECURITY DEFINER numbering touches it.

create policy tickets_read on public.tickets
  for select to authenticated
  using (requester_id = auth.uid() or public.is_it_staff());
create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (requester_id = auth.uid() or public.is_it_staff());
create policy tickets_update on public.tickets
  for update to authenticated
  using (requester_id = auth.uid() or public.is_it_staff())
  with check (requester_id = auth.uid() or public.is_it_staff());
create policy tickets_delete on public.tickets
  for delete to authenticated using (public.is_admin());

create policy comments_read on public.ticket_comments
  for select to authenticated
  using (public.can_see_ticket(ticket_id)
         and (not is_internal or public.is_it_staff()));
create policy comments_insert on public.ticket_comments
  for insert to authenticated
  with check (author_id = auth.uid()
              and public.can_see_ticket(ticket_id)
              and (not is_internal or public.is_it_staff()));

create policy attachments_read on public.ticket_attachments
  for select to authenticated
  using (public.can_see_ticket(ticket_id)
         and (comment_id is null or public.is_it_staff() or exists (
           select 1 from public.ticket_comments c
           where c.id = comment_id and not c.is_internal)));
create policy attachments_insert on public.ticket_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_ticket(ticket_id));

create policy events_read on public.ticket_events
  for select to authenticated using (public.can_see_ticket(ticket_id));

create policy notifications_read on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Only read_at may be changed by its owner.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Internal helpers are not for calling over the API.
revoke execute on function public.next_ticket_no(timestamptz) from public, anon, authenticated;
revoke execute on function public.notify_users(uuid[], uuid, text, text) from public, anon, authenticated;
revoke execute on function public.staff_ids(boolean) from public, anon, authenticated;
revoke execute on function public.update_ticket(uuid, public.ticket_status, uuid, boolean, public.ticket_priority, uuid, text) from public, anon;
grant execute on function public.update_ticket(uuid, public.ticket_status, uuid, boolean, public.ticket_priority, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Attachment storage: a private bucket, one folder per ticket id.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-attachments', 'ticket-attachments', false, 26214400)  -- 25 MB per file
on conflict (id) do nothing;

create or replace function public.ticket_id_from_path(path text)
returns uuid
language plpgsql immutable as $$
declare
  head text := split_part(path, '/', 1);
begin
  if head ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return head::uuid;
  end if;
  return null;
end;
$$;

create policy ticket_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'ticket-attachments'
         and public.can_see_ticket(public.ticket_id_from_path(name)));

create policy ticket_files_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ticket-attachments'
              and public.can_see_ticket(public.ticket_id_from_path(name)));
