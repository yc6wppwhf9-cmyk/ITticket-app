"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/auth-card";
import { Avatar } from "@/components/avatar";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type AppRole } from "@/lib/types";

type Item = { href: string; label: string; roles?: AppRole[]; icon: string; badge?: "unread" };
type Group = { title: string; items: Item[] };

// Heroicons-style outline paths.
const I = {
  plus: "M12 4.5v15m7.5-7.5h-15",
  ticket: "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z",
  bell: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0",
  chart: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  users: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  folders: "M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z",
  user: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  search: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z",
  logout: "M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9",
  menu: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5",
  close: "M6 18L18 6M6 6l12 12",
};

const GROUPS: Group[] = [
  {
    title: "Workspace",
    items: [
      { href: "/tickets", label: "Tickets", icon: I.ticket },
      { href: "/tickets/new", label: "Raise a Ticket", icon: I.plus },
      { href: "/notifications", label: "Notifications", icon: I.bell, badge: "unread" },
    ],
  },
  {
    title: "Insights",
    items: [{ href: "/reports", label: "MIS Reports", roles: ["agent", "admin"], icon: I.chart }],
  },
  {
    title: "Administration",
    items: [
      { href: "/admin/users", label: "Users", roles: ["admin"], icon: I.users },
      { href: "/admin/masters", label: "Departments & Categories", roles: ["admin"], icon: I.folders },
    ],
  },
  { title: "Account", items: [{ href: "/profile", label: "My Profile", icon: I.user }] },
];

/** A tiny spinner inside whichever menu link is still loading. */
function PendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" aria-hidden />;
}

export function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export function AppNav({
  me,
  unread,
  children,
}: {
  me: { name: string; email: string; role: AppRole; department: string | null };
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(me.role)) })).filter(
    (g) => g.items.length > 0
  );

  const active = (href: string) =>
    href === "/tickets"
      ? pathname === "/tickets" || (pathname.startsWith("/tickets/") && pathname !== "/tickets/new")
      : pathname === href || pathname.startsWith(`${href}/`);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/tickets" className="flex items-center gap-3 px-5 pb-6 pt-6">
        <Logo size={36} />
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-white">Helpdesk</div>
          <div className="text-[11px] font-medium text-slate-400">IT &amp; Ginesys</div>
        </div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{g.title}</div>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const on = active(i.href);
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition ${
                        on ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      }`}
                    >
                      {on && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-400" />}
                      <Icon d={i.icon} className={`h-[18px] w-[18px] shrink-0 ${on ? "text-indigo-300" : "text-slate-500 group-hover:text-slate-300"}`} />
                      <span className="flex-1">{i.label}</span>
                      <PendingSpinner />
                      {i.badge === "unread" && unread > 0 && (
                        <span className="rounded-full bg-rose-500 px-1.5 py-px text-[10px] font-bold text-white shadow-[0_0_0_3px_rgba(244,63,94,0.18)]">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-white/5 p-3 ring-1 ring-inset ring-white/10">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white" title={me.name}>{me.name}</div>
            <div className="truncate text-[11px] text-slate-400" title={me.email}>
              {ROLE_LABEL[me.role]}{me.department ? ` · ${me.department}` : ""}
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" title="Sign out" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
              <Icon d={I.logout} className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-[#0b1020] md:block">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_0%_0%,rgba(99,102,241,0.25),transparent_60%),radial-gradient(30rem_20rem_at_100%_100%,rgba(139,92,246,0.15),transparent_60%)]" />
        <div className="relative h-full">{sidebar}</div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside
            className="animate-rise absolute inset-y-0 left-0 w-72 bg-[#0b1020] shadow-2xl"
            onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
          >
            <button className="absolute right-3 top-6 rounded-lg p-2 text-slate-400 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <Icon d={I.close} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[92rem] items-center gap-3 px-4 py-3 sm:px-8">
            <button className="btn-ghost -ml-2 px-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Icon d={I.menu} className="h-5 w-5" />
            </button>
            <Link href="/tickets" className="flex items-center gap-2 md:hidden">
              <Logo size={28} />
              <span className="text-sm font-extrabold">Helpdesk</span>
            </Link>

            <form
              className="relative hidden max-w-md flex-1 sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
                router.push(q ? `/tickets?status=all&view=${me.role === "requester" ? "mine" : "all"}&q=${encodeURIComponent(q)}` : "/tickets");
              }}
            >
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Icon d={I.search} className="h-4 w-4" />
              </span>
              <input
                name="q"
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/80 py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
                placeholder="Search tickets by number or subject…"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/notifications"
                className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
              >
                <Icon d={I.bell} className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/tickets/new" className="btn-primary hidden sm:inline-flex">
                <Icon d={I.plus} className="h-4 w-4" /> Raise ticket
              </Link>
              <Link href="/profile" className="md:hidden" aria-label="My profile">
                <Avatar name={me.name} size={32} />
              </Link>
            </div>
          </div>
        </header>

        <main className="animate-rise mx-auto max-w-[92rem] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
