import { AuthSurface } from "../../../components/auth-surface";
import { SignInForm } from "../../../components/auth-forms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Sign in · VranceFlex" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/dashboard";

  return (
    <AuthSurface
      description="Return to your evidence-backed campaign workspace. Sessions are owned by VranceFlex and stored securely in Neon."
      eyebrow="WELCOME BACK"
      title="Continue building pipeline with control."
    >
      <SignInForm nextPath={nextPath} />
    </AuthSurface>
  );
}
