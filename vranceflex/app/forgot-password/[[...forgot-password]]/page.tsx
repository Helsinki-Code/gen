import { ForgotPasswordFlow } from "../../../components/auth-forms";
import { AuthSurface } from "../../../components/auth-surface";

export const metadata = { title: "Recover account · VranceFlex" };

export default function ForgotPasswordPage() {
  return (
    <AuthSurface
      description="Recover access using a short-lived email code. Completing a reset revokes every existing session."
      eyebrow="SECURE RECOVERY"
      title="Get back to your workspace safely."
    >
      <ForgotPasswordFlow />
    </AuthSurface>
  );
}
