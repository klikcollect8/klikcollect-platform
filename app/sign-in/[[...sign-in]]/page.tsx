import { SignIn } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { clerkAppearance } from "@/lib/clerk-appearance";

type SignInPageProps = {
  searchParams: Promise<{ notice?: string; redirect?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const notice = params.notice?.trim() || null;
  const redirect = params.redirect?.trim() || "/";

  return (
    <AuthShell
      eyebrow="Account"
      title="Sign in"
      description="Access your orders, saved items, and click & collect pickups."
      notice={notice}
      alternateHref="/sign-up"
      alternateLabel="New here?"
      alternateCta="Create an account"
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl={redirect}
        fallbackRedirectUrl={redirect}
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
