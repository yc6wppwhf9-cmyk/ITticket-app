const PALETTE = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
  "from-cyan-500 to-blue-500",
];

function initials(name: string): string {
  const parts = name.trim().split(/[\s._@-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Initials on a gradient picked from the name, so each person keeps a colour. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white/70 ${PALETTE[h % PALETTE.length]}`}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Avatar + name, for table cells and info rows. */
export function Person({ name, sub, size = 26 }: { name: string; sub?: string | null; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={size} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-medium text-slate-800">{name}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
    </span>
  );
}
