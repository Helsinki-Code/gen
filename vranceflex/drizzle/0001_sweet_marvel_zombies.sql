CREATE TYPE "public"."evidence_kind" AS ENUM('company', 'person', 'contact', 'intent');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'qualified', 'needs_review', 'approved', 'suppressed');--> statement-breakpoint
CREATE TABLE "enrichment_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"icp_profile_id" uuid,
	"lead_id" uuid,
	"kind" "evidence_kind" NOT NULL,
	"provider" text NOT NULL,
	"source_url" text NOT NULL,
	"source_title" text NOT NULL,
	"excerpt" text NOT NULL,
	"confidence" integer NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "icp_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"confidence" integer NOT NULL,
	"company_profile" jsonb NOT NULL,
	"buyer_roles" jsonb NOT NULL,
	"pain_points" jsonb NOT NULL,
	"buying_signals" jsonb NOT NULL,
	"exclusions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"icp_profile_id" uuid,
	"source_provider" text NOT NULL,
	"source_lead_id" text NOT NULL,
	"company_name" text NOT NULL,
	"company_domain" text,
	"company_size" text,
	"industry" text,
	"geography" text,
	"person_name" text NOT NULL,
	"job_title" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone" text,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"linkedin_url" text,
	"confidence" integer NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"buying_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_icp_profile_id_icp_profiles_id_fk" FOREIGN KEY ("icp_profile_id") REFERENCES "public"."icp_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_evidence" ADD CONSTRAINT "enrichment_evidence_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icp_profiles" ADD CONSTRAINT "icp_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icp_profiles" ADD CONSTRAINT "icp_profiles_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_icp_profile_id_icp_profiles_id_fk" FOREIGN KEY ("icp_profile_id") REFERENCES "public"."icp_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_org_campaign_idx" ON "enrichment_evidence" USING btree ("organization_id","campaign_id");--> statement-breakpoint
CREATE INDEX "evidence_lead_idx" ON "enrichment_evidence" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "evidence_icp_idx" ON "enrichment_evidence" USING btree ("icp_profile_id");--> statement-breakpoint
CREATE INDEX "icp_profiles_org_campaign_idx" ON "icp_profiles" USING btree ("organization_id","campaign_id");--> statement-breakpoint
CREATE INDEX "icp_profiles_org_created_idx" ON "icp_profiles" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_org_source_unique" ON "leads" USING btree ("organization_id","source_provider","source_lead_id");--> statement-breakpoint
CREATE INDEX "leads_org_campaign_idx" ON "leads" USING btree ("organization_id","campaign_id");--> statement-breakpoint
CREATE INDEX "leads_org_confidence_idx" ON "leads" USING btree ("organization_id","confidence");--> statement-breakpoint
CREATE INDEX "leads_org_status_idx" ON "leads" USING btree ("organization_id","status");