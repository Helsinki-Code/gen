export const PRICING_CURRENCY = "GBP" as const;

export type SubscriptionPlanId = "starter" | "professional" | "enterprise";
export type SubscriptionPlanLevel = "starter" | "pro" | "all";

/** Single-campaign list price and 10-campaign pack discount. */
export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  level: SubscriptionPlanLevel;
  /** Credits granted when buying one campaign (8 credits ≈ 1 campaign run). */
  creditsPerCampaign: number;
  /** Headline: price for one campaign. */
  pricePerCampaign: number;
  /** Buy 10 campaigns as a pack. */
  packCampaignCount: number;
  /** List price for the 10-campaign pack before discount (usually 10 × unit, or explicit list). */
  packListPrice: number;
  /** Percent off the 10-campaign pack. */
  packDiscountPercent: number;
  /** Pack price after discount. */
  packPrice: number;
  popular?: boolean;
}

const CREDITS_PER_CAMPAIGN = 8;
const PACK_SIZE = 10;

const STARTER_UNIT = 599;
const PROFESSIONAL_UNIT = 2999;
const ENTERPRISE_UNIT = 4999;

/** Starter 10-pack list is £5,999 (not exactly 10×599), then 10% off. */
const STARTER_PACK_LIST = 5999;
const PROFESSIONAL_PACK_LIST = PROFESSIONAL_UNIT * PACK_SIZE;
const ENTERPRISE_PACK_LIST = ENTERPRISE_UNIT * PACK_SIZE;

function packAfterDiscount(listPrice: number, discountPercent: number): number {
  return Math.round(listPrice * (1 - discountPercent / 100));
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    level: "starter",
    creditsPerCampaign: CREDITS_PER_CAMPAIGN,
    pricePerCampaign: STARTER_UNIT,
    packCampaignCount: PACK_SIZE,
    packListPrice: STARTER_PACK_LIST,
    packDiscountPercent: 10,
    packPrice: packAfterDiscount(STARTER_PACK_LIST, 10),
  },
  {
    id: "professional",
    name: "Professional",
    level: "pro",
    creditsPerCampaign: CREDITS_PER_CAMPAIGN,
    pricePerCampaign: PROFESSIONAL_UNIT,
    packCampaignCount: PACK_SIZE,
    packListPrice: PROFESSIONAL_PACK_LIST,
    packDiscountPercent: 15,
    packPrice: packAfterDiscount(PROFESSIONAL_PACK_LIST, 15),
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    level: "all",
    creditsPerCampaign: CREDITS_PER_CAMPAIGN,
    pricePerCampaign: ENTERPRISE_UNIT,
    packCampaignCount: PACK_SIZE,
    packListPrice: ENTERPRISE_PACK_LIST,
    packDiscountPercent: 20,
    packPrice: packAfterDiscount(ENTERPRISE_PACK_LIST, 20),
  },
];

export function formatPlanPrice(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: PRICING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const PAYG_CREDIT_PRICE_GBP = 0.35;
export const APPROX_PAYG_RUN_GBP = PAYG_CREDIT_PRICE_GBP * CREDITS_PER_CAMPAIGN;

/** Checkout plan id sent to the API (matches Stripe metadata.plan). */
export const STRIPE_CHECKOUT_PLAN_IDS = {
  starter: "starter",
  professional: "professional",
  enterprise: "enterprise",
} as const;

/** @deprecated Use STRIPE_CHECKOUT_PLAN_IDS */
export const LEGACY_STRIPE_PLAN_IDS = STRIPE_CHECKOUT_PLAN_IDS;
