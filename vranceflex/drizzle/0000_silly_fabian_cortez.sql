CREATE TYPE "public"."approval_scope" AS ENUM('first_launch', 'batch');--> statement-breakpoint
CREATE TYPE "public"."campaign_source_kind" AS ENUM('website', 'product_idea');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'researching', 'enriching', 'copy_generated', 'awaiting_approval', 'scheduled', 'sent', 'delivered', 'replied', 'stopped');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('admin', 'member', 'reviewer', 'billing');--> statement-breakpoint
CREATE TABLE "approval_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"approved_by" text NOT NULL,
	"scope" "approval_scope" NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"campaign_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"business_name" text NOT NULL,
	"product_name" text NOT NULL,
	"product_summary" text NOT NULL,
	"source_kind" "campaign_source_kind" NOT NULL,
	"source" jsonb NOT NULL,
	"audience" text NOT NULL,
	"geography" text NOT NULL,
	"goal" text NOT NULL,
	"lead_count" integer NOT NULL,
	"monthly_budget_usd" integer NOT NULL,
	"channels" jsonb NOT NULL,
	"status" "campaign_status" DEFAULT 'researching' NOT NULL,
	"provider_send_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "membership_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"campaign_id" uuid,
	"kind" text NOT NULL,
	"quantity" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_campaign_idx" ON "approval_records" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "approvals_org_idx" ON "approval_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_org_occurred_idx" ON "audit_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_org_idempotency_unique" ON "campaigns" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "campaigns_org_created_idx" ON "campaigns" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_org_status_idx" ON "campaigns" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_org_idempotency_unique" ON "usage_ledger" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_org_occurred_idx" ON "usage_ledger" USING btree ("organization_id","occurred_at");