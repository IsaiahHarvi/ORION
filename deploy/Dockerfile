FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS base

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml uv.lock README.md ./


FROM base AS api

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-default-groups --group api

COPY data/nexrad_stations.csv data/nexrad_stations.csv
COPY src/services/ src/services/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-default-groups --group api

EXPOSE 5171

CMD ["uvicorn", "services.api.api:app", "--host", "0.0.0.0", "--port", "5171", "--workers", "2"]


FROM base AS nexrad

# rasterio's wheel links against libexpat, which the slim base does not carry.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libexpat1 \
    && rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-default-groups --group nexrad

COPY data/nexrad_stations.csv data/nexrad_stations.csv
COPY src/services/ src/services/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-default-groups --group nexrad

CMD ["orion-nexrad"]
