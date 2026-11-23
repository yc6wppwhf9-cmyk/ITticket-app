"use client";

import { useActionState } from "react";
import { signUp } from "@/app/login/actions";
import { FormMessage, SubmitButton } from "@/components/submit-button";

export function SignupForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, action] = useActionState(signUp, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="full_name">Full name</label>
        <input className="input" id="full_name" name="full_name" autoComplete="name" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="department_id">Department</label>
        <select className="input" id="department_id" name="department_id" required defaultValue="">
          <option value="" disabled>Select your department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {departments.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">No departments set up yet. Ask IT to add them first.</p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone / extension <span className="font-normal text-slate-400">(optional)</span></label>
        <input className="input" id="phone" name="phone" autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
