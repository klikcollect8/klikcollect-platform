import { SignUp } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { clerkAppearance } from "@/lib/clerk-appearance";

type SignUpPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const redirect = params.redirect?.trim() || "/";

  return (
    <AuthShell
      eyebrow="Join KlikCollect"
      title="Create account"
      description="Shop local vendors and collect on your schedule."
      alternateHref="/sign-in"
      alternateLabel="Already have an account?"
      alternateCta="Sign in"
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl={redirect}
        fallbackRedirectUrl={redirect}
        appearance={clerkAppearance}
      />
    </AuthShell>
  );
}
