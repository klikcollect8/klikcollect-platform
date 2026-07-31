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
      title="Create your account"
      description="Start collecting from trusted vendors — free, fast, and built for everyday life."
      alternateHref="/sign-in"
      alternateLabel="Already have an account?"
      alternateCta="Sign in"
      stageTitle="Your neighbourhood market, finally organised."
      stageBody="Create a free account to save favourites, reorder in a tap, and collect when it suits you."
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
