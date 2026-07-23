export type IntegrationStatus = {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  required: boolean;
};

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      id: "parallel",
      name: "Parallel",
      description: "Lead research, discovery and evidence-backed enrichment",
      configured: configured("PARALLEL_API_KEY"),
      required: true,
    },
    {
      id: "ai",
      name: "AI model gateway",
      description: "Eve orchestrator and specialist model access",
      configured: configured("AI_GATEWAY_API_KEY") || configured("VERCEL_OIDC_TOKEN"),
      required: true,
    },
    {
      id: "email",
      name: "Email delivery",
      description: "Verified-domain outbound delivery and event webhooks",
      configured: configured("EMAIL_PROVIDER_API_KEY"),
      required: true,
    },
    {
      id: "sms",
      name: "Twilio SMS",
      description: "Approved sender, delivery tracking and inbound replies",
      configured:
        configured("TWILIO_ACCOUNT_SID") &&
        configured("TWILIO_AUTH_TOKEN") &&
        configured("TWILIO_MESSAGING_SERVICE_SID"),
      required: false,
    },
    {
      id: "database",
      name: "PostgreSQL",
      description: "Durable organization, campaign, approval and audit data",
      configured: configured("DATABASE_URL"),
      required: true,
    },
    {
      id: "storage",
      name: "File storage",
      description: "CSV imports, exports and generated campaign reports",
      configured: configured("STORAGE_BUCKET"),
      required: false,
    },
    {
      id: "monitoring",
      name: "Error monitoring",
      description: "Production exceptions, provider failures and job alerts",
      configured: configured("ERROR_MONITORING_DSN"),
      required: true,
    },
    {
      id: "analytics",
      name: "Product analytics",
      description: "Privacy-aware onboarding and campaign funnel analytics",
      configured: configured("NEXT_PUBLIC_ANALYTICS_KEY"),
      required: false,
    },
  ];
}
