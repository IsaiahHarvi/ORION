#!/usr/bin/env bash
set -euo pipefail

REGISTRY="ghcr.io/isaiahharvi/orion"

SERVICES=(gui api)

# Optional: override default VITE_API_URL for gui
: "${VITE_API_URL:=https://orion.harville.dev/api}"

for svc in "${SERVICES[@]}"; do
  NAME="orion-${svc}"
  IMAGE="${REGISTRY}/${NAME}:latest"
  DOCKERFILE="deploy/${svc}/Dockerfile"
  CONTEXT="."

  echo "--- Building ${NAME} → ${IMAGE}"
  docker build \
    --build-arg VITE_API_URL="${VITE_API_URL}" \
    -f "${DOCKERFILE}" \
    -t "${IMAGE}" \
    "${CONTEXT}"

  echo "--- Pushing ${IMAGE}"
  docker push "${IMAGE}"
done

echo "All images built & pushed to ${REGISTRY}"

