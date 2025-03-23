FROM node:20

WORKDIR /app/src/app

COPY src/app/ .
RUN npm i

EXPOSE 5173

CMD ["sh", "-c", "npm i && npm run dev -- --host 0.0.0.0 --port 5173"]
