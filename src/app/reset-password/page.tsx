"use client";

import { useActionState } from "react";
import { AuthCard } from "@/components/auth-card";
import { setNewPassword } from "@/app/login/actions";
import { FormMessage, SubmitButton } from "@/components/submit-button";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(setNewPassword, undefined);
  return (
    <AuthCard title="Choose a new password">
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input className="input" id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full" pendingText="Saving…">Save password</SubmitButton>
      </form>
    </AuthCard>
  );
}
