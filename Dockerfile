# AI Remove Pilot — container image.
#
# Use this to run the app somewhere without a request-body cap, which is what
# the advertised 25 MB limit needs. Debian slim rather than Alpine: sharp links
# against libvips, and glibc prebuilds are the best-supported path.

# ---- dependencies ----------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Installed inside the image so sharp resolves the Linux binary for this
# platform, not whatever the build machine happened to have.
RUN npm ci

# ---- build -----------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ---------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN useradd --create-home --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# sharp is marked external so Next does not bundle it. Copying it and its
# platform binaries explicitly means the image does not depend on the file
# tracer having picked them up.
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/@img ./node_modules/@img

USER nextjs
EXPOSE 3000

# No healthcheck endpoint is needed: GET /api/process reports the limits and
# touches nothing, so it doubles as a liveness probe.
CMD ["node", "server.js"]
