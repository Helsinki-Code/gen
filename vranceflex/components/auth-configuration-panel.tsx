import { KeyRound, ServerCog, ShieldCheck } from "lucide-react";

export function AuthConfigurationPanel() {
  return (
    <section className="auth-setup-card">
      <span className="auth-icon"><KeyRound size={23} /></span>
      <p className="section-label">SECURE SETUP REQUIRED</p>
      <h2>Connect identity before inviting customers.</h2>
      <p>
        VranceFlex keeps production account routes closed until Neon, the session
        secret and email OTP delivery are configured through the hosting platform.
      </p>
      <div className="auth-requirements">
        <div><ShieldCheck size={17} /><span><strong>Authentication</strong><small>Neon sessions and Resend email OTPs</small></span></div>
        <div><ServerCog size={17} /><span><strong>Organizations</strong><small>Database-backed membership required</small></span></div>
      </div>
      <a className="button-primary" href="/">Return to the public site</a>
    </section>
  );
}
