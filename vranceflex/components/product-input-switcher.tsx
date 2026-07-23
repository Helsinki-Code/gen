"use client";

import { ArrowRight, Globe2, Lightbulb } from "lucide-react";
import { useState } from "react";

export function ProductInputSwitcher() {
  const [mode, setMode] = useState<"website" | "idea">("website");
  const [value, setValue] = useState("");

  const href =
    mode === "website"
      ? `/campaigns/new?mode=website&url=${encodeURIComponent(value)}`
      : `/campaigns/new?mode=idea&idea=${encodeURIComponent(value)}`;

  return (
    <div className="source-intake">
      <div className="source-tabs" role="tablist" aria-label="How would you like to start?">
        <button
          aria-selected={mode === "website"}
          className={mode === "website" ? "active" : ""}
          onClick={() => setMode("website")}
          role="tab"
          type="button"
        >
          <Globe2 size={15} /> I have a website
        </button>
        <button
          aria-selected={mode === "idea"}
          className={mode === "idea" ? "active" : ""}
          onClick={() => setMode("idea")}
          role="tab"
          type="button"
        >
          <Lightbulb size={15} /> I have a product idea
        </button>
      </div>
      <div className="source-field">
        {mode === "website" ? (
          <input
            aria-label="Website URL"
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://yourcompany.com"
            type="url"
            value={value}
          />
        ) : (
          <textarea
            aria-label="Product idea"
            onChange={(event) => setValue(event.target.value)}
            placeholder="Describe the product, who it helps and the problem it solves…"
            rows={3}
            value={value}
          />
        )}
        <a
          aria-disabled={!value.trim()}
          className="source-submit"
          href={value.trim() ? href : undefined}
          onClick={(event) => {
            if (!value.trim()) event.preventDefault();
          }}
        >
          Build my campaign <ArrowRight size={17} />
        </a>
      </div>
      <p>No website needed. A clear product idea is enough to research a market and build an ICP.</p>
    </div>
  );
}
