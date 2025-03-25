## Development Build (ignores TS errors)
# FROM node:20

# WORKDIR /app/src/app

# COPY src/app/ .
# RUN npm i

# EXPOSE 5173

# CMD ["sh", "-c", "npm i && npm run dev -- --host 0.0.0.0 --port 5173"]

# Production Build
FROM node:20 AS builder
ENV PORT=5173
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/src/app
COPY src/app/package*.json ./
RUN npm install
COPY src/app/ .
RUN npm run build

# Runner stage: copy package.json, node_modules, and build output
FROM node:20 AS runner

WORKDIR /app/src/app
COPY --from=builder /app/src/app/package*.json ./
COPY --from=builder /app/src/app/node_modules ./node_modules
COPY --from=builder /app/src/app/build ./build

EXPOSE 5173
# CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
CMD ["sh", "-c", "PORT=5173 node build"]
