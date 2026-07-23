export const ADMIN_EMAILS = [
  "vikram@vranceflex.online",
  "info@agentic-ai.ltd",
  "sa@amrogen.com",
  "info@amrogen.com",
  "hemant@joshi.me",
];

export function isAdminEmail(email?: string | null) {
  return Boolean(email && ADMIN_EMAILS.includes(email.trim().toLowerCase()));
}
