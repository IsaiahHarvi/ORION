FROM node:24-bookworm-slim AS builder

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY src/app/package.json ./src/app/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY src/app ./src/app
RUN pnpm --filter app build

RUN pnpm --filter app deploy --prod --legacy /out


FROM gcr.io/distroless/nodejs24-debian12:nonroot AS runner

ENV NODE_ENV=production \
    PORT=5173 \
    HOST=0.0.0.0

WORKDIR /app
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /app/src/app/build ./build
COPY --from=builder /app/src/app/package.json ./package.json

EXPOSE 5173

CMD ["build"]
