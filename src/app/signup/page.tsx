import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  // Departments are readable only when signed in, so the list for the
  // sign-up form comes from a dedicated security-definer function.
  const supabase = await createClient();
  const { data } = await supabase.rpc("signup_departments");
  return (
    <AuthCard
      title="Create your account"
      subtitle="You'll be able to raise tickets right away."
      footer={<>Already registered? <Link className="font-semibold text-indigo-600 hover:underline" href="/login">Sign in</Link></>}
    >
      <SignupForm departments={(data ?? []) as { id: string; name: string }[]} />
    </AuthCard>
  );
}
