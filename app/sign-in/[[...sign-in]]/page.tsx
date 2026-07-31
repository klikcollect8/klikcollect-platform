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
      eyebrow="Welcome back"
      title="Sign in"
      description="One account for your bag, saved picks, and pickup updates."
      notice={notice}
      alternateHref="/sign-up"
      alternateLabel="New to KlikCollect?"
      alternateCta="Create an account"
      stageTitle="Shop the city. Collect on your time."
      stageBody="The best of Nairobi's neighbourhood vendors — ordered in minutes, ready when you walk in."
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
