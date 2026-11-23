"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/auth-card";
import { signOut } from "@/app/login/actions";
import { ROLE_LABEL, type AppRole } from "@/lib/types";

type Item = { href: string; label: string; roles?: AppRole[]; icon: string };

// Heroicons-style outline paths.
const NAV: Item[] = [
  { href: "/tickets/new", label: "Raise a Ticket", icon: "M12 4v16m8-8H4" },
  { href: "/tickets", label: "Tickets", icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" },
  { href: "/notifications", label: "Notifications", icon: "M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { href: "/reports", label: "MIS Reports", roles: ["agent", "admin"], icon: "M9 19v-6m4 6V5m4 14v-9M4 19h16" },
  { href: "/admin/users", label: "Users", roles: ["admin"], icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/admin/masters", label: "Departments & Categories", roles: ["admin"], icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
  { href: "/profile", label: "My Profile", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
];

function Icon({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => !i.roles || i.roles.includes(me.role));

  const active = (href: string) =>
    href === "/tickets"
      ? pathname === "/tickets" || (pathname.startsWith("/tickets/") && pathname !== "/tickets/new")
      : pathname === href || pathname.startsWith(`${href}/`);

  const links = (
    <ul className="space-y-1 text-sm">
      {items.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition ${
              active(i.href)
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            <Icon d={i.icon} className={`h-4 w-4 shrink-0 ${active(i.href) ? "text-white" : "text-slate-400"}`} />
            <span className="flex-1">{i.label}</span>
            {i.href === "/notifications" && unread > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${active(i.href) ? "bg-white text-indigo-700" : "bg-rose-500 text-white"}`}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-sm md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              <Icon d={open ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </button>
            <Link href="/tickets" className="flex items-center gap-2.5">
              <Logo size={32} />
              <div className="leading-tight">
                <div className="text-sm font-extrabold tracking-tight">IT &amp; Ginesys Helpdesk</div>
                <div className="hidden text-[11px] text-slate-500 sm:block">Ticketing · Tracking · MIS</div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
              <Icon d={NAV[2].icon} className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </Link>
            <div className="hidden min-w-0 text-right sm:block">
              <div className="max-w-[14rem] truncate text-xs font-semibold">{me.name}</div>
              <div className="max-w-[14rem] truncate text-[11px] text-slate-500">
                {ROLE_LABEL[me.role]}{me.department ? ` · ${me.department}` : ""}
              </div>
            </div>
            <form action={signOut}>
              <button className="btn btn-sm" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <nav className="absolute left-0 top-0 h-full w-72 bg-white p-4 pt-20 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {links}
          </nav>
        </div>
      )}

      <div className="mx-auto flex max-w-[96rem] gap-6 px-4 py-6 sm:px-6">
        <nav className="hidden w-56 shrink-0 md:block">
          <div className="card sticky top-20 p-2.5">{links}</div>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
