import Link from "next/link";

const POINTS = [
  { t: "Raise in seconds", d: "Pick a category, describe it, paste a screenshot. You get a ticket number instantly." },
  { t: "Always know where it stands", d: "Open, in progress, pending, resolved — with every remark and update in one timeline." },
  { t: "Nothing slips through", d: "Assignment, notifications and ageing reports keep every request moving." },
];

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#0b1020] p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45rem_30rem_at_10%_0%,rgba(99,102,241,0.45),transparent_60%),radial-gradient(40rem_30rem_at_100%_100%,rgba(139,92,246,0.35),transparent_60%),radial-gradient(25rem_20rem_at_80%_20%,rgba(6,182,212,0.18),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="relative flex items-center gap-3">
          <Logo size={40} />
          <div className="leading-tight">
            <div className="text-lg font-extrabold tracking-tight">Helpdesk</div>
            <div className="text-xs text-slate-400">IT &amp; Ginesys</div>
          </div>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-tight">
            One place for every{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">IT &amp; Ginesys</span>{" "}
            request.
          </h2>
          <ul className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <li key={p.t} className="flex gap-3.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <svg className="h-3.5 w-3.5 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <div>
                  <div className="font-semibold">{p.t}</div>
                  <div className="text-sm text-slate-400">{p.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative mt-12 text-xs text-slate-500">Internal use · Raise, track and resolve.</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="animate-rise w-full max-w-[25rem]">
          <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo size={34} />
            <span className="text-lg font-extrabold tracking-tight">IT &amp; Ginesys Helpdesk</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="muted mt-1.5">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-slate-600">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-[30%] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.7)] ring-1 ring-inset ring-white/20"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
      </svg>
    </span>
  );
}
