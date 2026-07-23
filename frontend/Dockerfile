# AmroGen frontend — Next.js standalone for Google Cloud Run
# Build context: frontend/ (gcloud run deploy --source .)
# Build-time vars: deploy/cloudrun-build-public.vars (from .env.production via generate-cloudrun-env.mjs)

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN set -e; \
  for attempt in 1 2 3 4 5; do \
    npm ci --legacy-peer-deps && exit 0; \
    echo "npm ci attempt $attempt failed"; \
    if [ "$attempt" -eq 5 ]; then exit 1; fi; \
    sleep $((attempt * 10)); \
  done

FROM node:20-alpine AS builder
WORKDIR /app
# Copy source first; node_modules from deps must win (Windows host node_modules lacks +x on .bin/*).
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Blog reads ../docs/latest from /app at runtime — staged by deploy-production.ps1
COPY .docker-build/docs /docs
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY deploy/cloudrun-build-public.vars* ./
RUN set -e; \
  if [ -f cloudrun-build-public.vars ]; then \
    cp cloudrun-build-public.vars .env.production; \
  elif [ -f cloudrun-build-public.vars.example ]; then \
    cp cloudrun-build-public.vars.example .env.production; \
  else \
    test -n "$NEXT_PUBLIC_API_URL" && test -n "$NEXT_PUBLIC_APP_URL" \
      || (echo "ERROR: set NEXT_PUBLIC_* in .env.production or cloudrun-build-public.vars" >&2 && exit 1); \
    SITE_URL="${NEXT_PUBLIC_SITE_URL:-$NEXT_PUBLIC_APP_URL}"; \
    printf "NODE_ENV=production\nNEXT_PUBLIC_API_URL=%s\nNEXT_PUBLIC_APP_URL=%s\nNEXT_PUBLIC_SITE_URL=%s\n" \
      "$NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_APP_URL" "$SITE_URL" > .env.production; \
  fi; \
  echo "Using NEXT_PUBLIC_API_URL=$(grep NEXT_PUBLIC_API_URL .env.production | cut -d= -f2-)"; \
  API_VAL="$(grep '^NEXT_PUBLIC_API_URL=' .env.production | cut -d= -f2-)"; \
  case "$API_VAL" in *localhost*|*127.0.0.1*) \
    echo "ERROR: NEXT_PUBLIC_API_URL must not be localhost in production Docker build" >&2; exit 1;; \
  esac
RUN export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-$(grep NEXT_PUBLIC_SITE_URL .env.production | cut -d= -f2-)}" \
  && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# fontconfig + DejaVu are required for sharp/librsvg to render the SVG text
# overlays stamped onto generated article images.
RUN apk add --no-cache fontconfig ttf-dejavu
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /docs /docs
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
