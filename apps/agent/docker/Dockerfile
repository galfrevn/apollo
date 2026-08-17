# The self-host image: a persistent Bun process running src/host/main.ts.
# Build context is the package root (apps/agent in the monorepo, the scaffold
# root in the starter) — both share the same package.json + src shape.
FROM oven/bun:1.3-slim

WORKDIR /app

COPY package.json ./
# Production install skips wrangler and the workspace-only tsconfig package,
# neither of which exists (or is needed) inside the container.
RUN bun install --production

# A minimal runtime tsconfig replaces the package one: Bun only needs the @/
# path alias here, and the package tsconfig extends dev-only packages.
COPY docker/tsconfig.json ./tsconfig.json
COPY src ./src

ENV APOLLO_DATA_DIRECTORY=/data
ENV APOLLO_HOST_PORT=8799
EXPOSE 8799

CMD ["bun", "src/host/main.ts"]
