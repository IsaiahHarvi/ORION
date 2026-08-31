FROM node:24 AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY src/app/package.json ./src/app/package.json
RUN pnpm install --frozen-lockfile
COPY src/app ./src/app
RUN pnpm --filter app build

FROM node:24 AS runner
ENV PORT=5173

WORKDIR /app/src/app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/src/app/node_modules ./node_modules
COPY --from=builder /app/src/app/build ./build

EXPOSE 5173
CMD ["node", "build"]
