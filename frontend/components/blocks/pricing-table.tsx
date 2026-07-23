"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckIcon, ArrowRightIcon } from "@radix-ui/react-icons"
import NumberFlow from "@number-flow/react"
import { formatPlanPrice, PRICING_CURRENCY } from "@/lib/pricing-plans"

export type PlanLevel = "starter" | "pro" | "all" | string

export interface PricingFeature {
  name: string
  included: PlanLevel | null
}

export interface PricingPlan {
  name: string
  level: PlanLevel
  pricePerCampaign: number
  packCampaignCount: number
  packListPrice: number
  packDiscountPercent: number
  packPrice: number
  popular?: boolean
}

export interface PricingTableProps
  extends React.HTMLAttributes<HTMLDivElement> {
  features: PricingFeature[]
  plans: PricingPlan[]
  onPlanSelect?: (plan: PlanLevel) => void
  defaultPlan?: PlanLevel
  containerClassName?: string
  buttonClassName?: string
}

export function PricingTable({
  features,
  plans,
  onPlanSelect,
  defaultPlan = "pro",
  className,
  containerClassName,
  buttonClassName,
  ...props
}: PricingTableProps) {
  const [selectedPlan, setSelectedPlan] = React.useState<PlanLevel>(defaultPlan)

  const handlePlanSelect = (plan: PlanLevel) => {
    setSelectedPlan(plan)
    onPlanSelect?.(plan)
  }

  return (
    <section
      className={cn(
        "bg-background text-foreground",
        "py-12 sm:py-24 md:py-32 px-4",
        "fade-bottom overflow-hidden pb-0",
      )}
    >
      <div
        className={cn("w-full max-w-3xl mx-auto px-4", containerClassName, className)}
        {...props}
      >
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Price is per campaign. Save when you buy a 10-campaign pack.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {plans.map((plan) => (
            <button
              key={plan.name}
              type="button"
              onClick={() => handlePlanSelect(plan.level)}
              className={cn(
                "flex-1 p-4 rounded-xl text-left transition-all",
                "border border-border",
                selectedPlan === plan.level &&
                  "ring-2 ring-primary",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{plan.name}</span>
                {plan.popular && (
                  <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <NumberFlow
                  format={{
                    style: "currency",
                    currency: PRICING_CURRENCY,
                    trailingZeroDisplay: "stripIfInteger",
                  }}
                  value={plan.pricePerCampaign}
                  className="text-2xl font-bold"
                />
                <span className="text-sm font-normal text-muted-foreground">
                  /campaign
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {plan.packCampaignCount}-pack: {formatPlanPrice(plan.packPrice)}{" "}
                <span className="text-primary">({plan.packDiscountPercent}% off</span>
                {" "}
                <span className="line-through">{formatPlanPrice(plan.packListPrice)}</span>
                )
              </p>
            </button>
          ))}
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] divide-y divide-border">
              <div className="flex items-center p-4 bg-muted/50">
                <div className="flex-1 text-sm font-medium">Features</div>
                <div className="flex items-center gap-8 text-sm">
                  {plans.map((plan) => (
                    <div
                      key={plan.level}
                      className="w-16 text-center font-medium"
                    >
                      {plan.name}
                    </div>
                  ))}
                </div>
              </div>
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className={cn(
                    "flex items-center p-4 transition-colors",
                    feature.included === selectedPlan &&
                      "bg-primary/5",
                  )}
                >
                  <div className="flex-1 text-sm">{feature.name}</div>
                  <div className="flex items-center gap-8 text-sm">
                    {plans.map((plan) => (
                      <div
                        key={plan.level}
                        className={cn(
                          "w-16 flex justify-center",
                          plan.level === selectedPlan && "font-medium",
                        )}
                      >
                        {shouldShowCheck(feature.included, plan.level) ? (
                          <CheckIcon className="w-5 h-5 text-primary" />
                        ) : (
                          <span className="text-muted-foreground/30">
                            -
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Button
            className={cn(
              "w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-2 rounded-xl",
              buttonClassName,
            )}
          >
            Get started with {plans.find((p) => p.level === selectedPlan)?.name}
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  )
}

function shouldShowCheck(
  included: PricingFeature["included"],
  level: string,
): boolean {
  if (included === "all") return true
  if (included === "pro" && (level === "pro" || level === "all")) return true
  if (
    included === "starter" &&
    (level === "starter" || level === "pro" || level === "all")
  )
    return true
  return false
}
