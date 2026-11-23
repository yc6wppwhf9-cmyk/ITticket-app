# IT & Ginesys Helpdesk

A ticket desk for IT and Ginesys requirements: raise a ticket, attach screenshots
or Excel files, track it to closure, and report on pending work, ageing and
turnaround by department.

Built with Next.js 16, Supabase (Postgres, Auth, Storage) and Resend for email.

## What it does

| Requirement | Where |
|---|---|
| Ticket creation with category, priority, subject, details | **Raise a Ticket** |
| Categories: Ginesys, Master Data / Item Master, BOM, User/Access, Report/ERP, System/Technical, New Development, Other | Seeded; editable under **Departments & Categories** |
| Attachments (screenshots, Excel, PDF, Word… 25 MB each; paste a screenshot with Ctrl+V) | New ticket, comments, “Add attachments” |
| Automatic ticket number `IT-2026-00001` (restarts each year) | Database trigger |
| Assignment to IT person, incl. auto-assign per category | Ticket page → Update ticket; category settings |
| Status Open → In Progress → Pending → Resolved → Closed | Ticket page; requester confirms & closes, or reopens |
| Remarks / comments / internal notes (IT only) | Ticket page |
| Date & time of raising, assignment, first action, resolution, closure | Ticket info panel, reports, Excel export |
| Notifications on raise / assign / status change / comment | In-app bell + email |
| Pending, completed and closed views | **Tickets** tabs: Pending / Completed / Closed / All |
| History for audit | Activity & history on each ticket (written by the database; cannot be edited) |
| MIS: department-wise pending, ageing, closure time | **MIS Reports** + Excel (CSV) export |

### Roles

- **Requester**: anyone in the company. Raises tickets, sees only their own, comments, and confirms or reopens a resolved ticket.
- **IT Agent**: sees and works every ticket; assigns, changes status, adds internal notes, sees MIS.
- **IT Admin**: everything an agent can do, plus users, departments and categories.

These rules are enforced by row-level security in the database, not just hidden in the UI.

## Setup

### 1. Supabase

1. Create a project at supabase.com (region **Mumbai / ap-south-1** is closest for India).
2. **SQL Editor → New query**: paste all of
   [`supabase/migrations/20261123000000_init.sql`](supabase/migrations/20261123000000_init.sql) and **Run**.
3. Add your departments (edit the list):
   ```sql
   insert into public.departments (name) values
     ('Accounts'), ('Production'), ('Purchase'), ('Stores'),
     ('Sales'), ('HR & Admin'), ('Quality'), ('IT');
   ```
4. **Authentication → URL Configuration**: set **Site URL** to your app URL and add
   `https://YOUR-APP/auth/confirm` to **Redirect URLs**.
5. **Authentication → Sign In / Providers → Email**: either turn **Confirm email** off
   (simplest for an internal tool), or set up custom SMTP. Supabase's built-in mailer
   only sends a few emails per hour, which is fine for testing but not for a whole company.

### 2. Deploy (Vercel)

Import this repo in Vercel and add these environment variables:

| Name | Type in Vercel | Value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Config | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Config | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase service_role key (server only) |
| `NEXT_PUBLIC_APP_URL` | Config | Your app's address, no trailing slash |
| `RESEND_API_KEY` | Secret | Optional, for email notifications |
| `EMAIL_FROM` | Config | Optional, e.g. `IT Helpdesk <helpdesk@yourcompany.com>` |

Then:

1. Open the app, **Create an account** for yourself.
2. Make yourself admin in the Supabase SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@yourcompany.com';
   ```
3. In the app, **Users**: add your IT team as **IT Agent** (or let them sign up and change
   their role). **Departments & Categories**: set an auto-assign person per category if you like.

### 3. Email notifications

Create a key at resend.com, verify your company domain, and set `RESEND_API_KEY` and
`EMAIL_FROM`. Without a key, notifications still appear in the app's bell.

## Local development

```bash
# create .env.local with the variables listed above
npm install
npm run dev
```

`npm test` runs the MIS calculation tests; `npm run typecheck` and `npm run lint` check the code.

## How it fits together

- `supabase/migrations/…_init.sql`: the whole schema. The database owns the important rules:
  ticket numbering, which fields each role may change, the status timestamps, the history
  log, and who gets notified. The app cannot get any of these wrong by accident.
- Notifications are rows in `notifications`, written by database triggers. The bell reads them;
  `src/lib/email.ts` mails each row once (it claims rows atomically before sending).
- Attachments upload straight from the browser to the private `ticket-attachments` bucket,
  under the ticket's folder; storage policies only let people who can see the ticket read or add files.
- MIS figures are computed in `src/lib/mis.ts`. Pending and ageing are a snapshot as of now;
  raised, resolved and turnaround cover the selected period (resolved counts by resolution date).
