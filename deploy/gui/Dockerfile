FROM node:20

WORKDIR /app/src/app

COPY src/app/ .
RUN npm i

EXPOSE 5173

CMD ["sh", "-c", "npm i && npm run dev -- --host 0.0.0.0 --port 5173"]

# # Build stage
# FROM node:20 as builder

# WORKDIR /app/src/app

# COPY src/app/package*.json ./
# RUN npm install

# COPY src/app/ .

# RUN npm run build

# # Production stage
# FROM node:20 as runner

# WORKDIR /app/src/app

# COPY --from=builder /app/src/app/dist ./dist

# EXPOSE 5173

# CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
