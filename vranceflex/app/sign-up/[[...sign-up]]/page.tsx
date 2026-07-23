import { SignUpFlow } from "../../../components/auth-forms";
import { AuthSurface } from "../../../components/auth-surface";

export const metadata = { title: "Create account · VranceFlex" };

export default function SignUpPage() {
  return (
    <AuthSurface
      description="Create a private workspace for your team. Every new account is verified by a short-lived email OTP before access is granted."
      eyebrow="START WITH CONTROL"
      title="Your market motion, in one verified workspace."
    >
      <SignUpFlow />
    </AuthSurface>
  );
}
