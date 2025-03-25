#!/usr/bin/env bash

docker compose --profile gui down -v || true

export VITE_API_URL=https://orion-api.harville.dev

docker compose --profile gui up --build -d
