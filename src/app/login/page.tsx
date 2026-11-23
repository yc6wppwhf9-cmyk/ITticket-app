import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Sign in"
      subtitle="Raise and track IT & Ginesys requests."
      footer={<>New here? <Link className="font-semibold text-indigo-600 hover:underline" href="/signup">Create an account</Link></>}
    >
      {error === "inactive" && (
        <p className="alert-error mb-4">Your account has been deactivated. Contact the IT team.</p>
      )}
      {error === "link" && (
        <p className="alert-error mb-4">That link has expired or was already used. Try again.</p>
      )}
      <LoginForm next={next} />
    </AuthCard>
  );
}
