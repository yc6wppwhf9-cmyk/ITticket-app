"use client";

import { useActionState, useState, useTransition } from "react";
import { createUser, updateUser } from "./actions";
import { FormMessage, SubmitButton } from "@/components/submit-button";
import { ROLE_LABEL, type AppRole } from "@/lib/types";

type Dept = { id: string; name: string };

export function NewUserForm({ departments }: { departments: Dept[] }) {
  const [state, action] = useActionState(createUser, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <div className="lg:col-span-1">
        <label className="label" htmlFor="nu_name">Full name</label>
        <input className="input" id="nu_name" name="full_name" required />
      </div>
      <div className="lg:col-span-1">
        <label className="label" htmlFor="nu_email">Email</label>
        <input className="input" id="nu_email" name="email" type="email" required />
      </div>
      <div>
        <label className="label" htmlFor="nu_dept">Department</label>
        <select className="input" id="nu_dept" name="department_id" defaultValue="">
          <option value="">—</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="nu_role">Role</label>
        <select className="input" id="nu_role" name="role" defaultValue="requester">
          {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="nu_pw">Temporary password</label>
        <input className="input" id="nu_pw" name="password" type="text" minLength={8} required autoComplete="off" />
      </div>
      <SubmitButton pendingText="Creating…">Add user</SubmitButton>
      <div className="sm:col-span-2 lg:col-span-6"><FormMessage state={state} /></div>
    </form>
  );
}

export function UserRow({
  user,
  departments,
  isMe,
}: {
  user: { id: string; role: AppRole; department_id: string | null; active: boolean };
  departments: Dept[];
  isMe: boolean;
}) {
  const [role, setRole] = useState(user.role);
  const [dept, setDept] = useState(user.department_id ?? "");
  const [active, setActive] = useState(user.active);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const dirty = role !== user.role || dept !== (user.department_id ?? "") || active !== user.active;

  const save = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", user.id);
      fd.set("role", role);
      fd.set("department_id", dept);
      fd.set("active", String(active));
      setMsg(await updateUser(fd));
    });

  return (
    <>
      <td className="td">
        <select className="input py-1" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">—</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </td>
      <td className="td">
        <select className="input py-1" value={role} onChange={(e) => setRole(e.target.value as AppRole)} disabled={isMe}>
          {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </td>
      <td className="td">
        <label className="flex items-center gap-2 whitespace-nowrap text-sm">
          <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={active} disabled={isMe} onChange={(e) => setActive(e.target.checked)} />
          {active ? "Active" : <span className="text-rose-600">Inactive</span>}
        </label>
      </td>
      <td className="td whitespace-nowrap">
        <button className="btn-primary btn-sm" disabled={!dirty || pending} onClick={save}>{pending ? "Saving…" : "Save"}</button>
        {msg?.error && <div className="mt-1 max-w-[14rem] text-xs text-rose-600">{msg.error}</div>}
        {msg?.ok && !dirty && <div className="mt-1 text-xs text-emerald-600">{msg.ok}</div>}
      </td>
    </>
  );
}
