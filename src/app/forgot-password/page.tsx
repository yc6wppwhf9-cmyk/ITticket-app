"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { sendReset } from "@/app/login/actions";
import { FormMessage, SubmitButton } from "@/components/submit-button";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(sendReset, undefined);
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={<Link className="font-semibold text-indigo-600 hover:underline" href="/login">Back to sign in</Link>}
    >
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoFocus />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send reset link</SubmitButton>
      </form>
    </AuthCard>
  );
}
