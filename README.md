# <img src="src/app/static/globe.png" alt="" width="20"> PROJECT ORION

_Observation, Reconnaissance, Intelligence, and Operations Network_

[![Version](https://img.shields.io/github/v/release/isaiah-harville/ORION.svg)](https://github.com/isaiah-harville/ORION/releases)
[![Tests Passing](https://img.shields.io/github/actions/workflow/status/isaiah-harville/ORION/integration.yml)](https://github.com/isaiah-harville/ORION/actions?query=workflow%3Atest)
[![GitHub Contributors](https://img.shields.io/github/contributors/isaiah-harville/ORION.svg)](https://github.com/isaiah-harville/ORION/graphs/contributors)
[![Issues](https://img.shields.io/github/issues/isaiah-harville/ORION.svg)](https://github.com/isaiah-harville/ORION/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/isaiah-harville/ORION.svg)](https://github.com/isaiah-harville/ORION/pulls)

---

A versatile software platform designed for use across missions in public safety, security, environmental monitoring, and defense. Leveraging machine learning, ORION filters and transforms data from diverse sources—including UAVs and NEXRAD—into actionable insights for effective decision-making.

**A presentation is available [here](docs/PROJECT_ORION.pdf)**

### <a>Production Version<a href = "https://orion.harville.dev/"></a>

---

A production version of this project is available at [orion.harville.dev](https://orion.harville.dev/).

## Development Version

Interested users can build the project themselves.

For local development, install pnpm through Corepack and
[uv](https://docs.astral.sh/uv/getting-started/installation/), then run ORION from
the repository root:

```bash
corepack enable
pnpm install
pnpm run dev
```

Turborepo starts the SvelteKit app, the FastAPI service, and the `nexrad` mosaic
service. The app is available at `http://localhost:5173`, and the API is available
at `http://localhost:5171`. The first radar frame may take several minutes while
NOAA volumes are downloaded and processed.

Python dependencies are locked in `uv.lock`; `uv sync` provisions the interpreter
from `.python-version` and installs both service groups plus the test tooling.

Local runtime artifacts are written to `data/dev-scans`. Do not run the development
stack with `sudo`; root-owned Vite caches and radar artifacts prevent normal hot
reloads and frame replacement.

Run the backend services individually when needed:

```bash
pnpm run dev:api
pnpm run dev:nexrad
```

1. **Start the Project:**

    Open your terminal in the project directory and start the Docker containers.

    ```bash
    git clone git@github.com:isaiah-harville/ORION.git
    cd ORION
    docker compose up --build
    # Optionally, to target the developmentAPI rather than a locally hosted API export the following env var
    export VITE_API_URL=http://localhost:5171
    ```

2. **Access the Application:**

    Once the containers are running, open your browser and navigate to:

    ```
    http://localhost:5173
    or
    http://127.0.0.1:5173
    ```

    This will load your project locally.

### Additional Information

## API
Our API is available at: https://orion.harville.dev/api/docs

## Deployment

Releases are cut by tagging `vX.Y.Z`. The Release workflow publishes the `api`,
`nexrad`, and `gui` images plus the Helm chart under that one version, so a chart
release always names the images built from the same commit. Images also get a
`latest` tag, which is what `docker compose` follows when `ORION_VERSION` is unset;
the chart and Kubernetes always pin an explicit version.

```
ghcr.io/isaiah-harville/orion/orion-{api,nexrad,gui}:X.Y.Z
oci://ghcr.io/isaiah-harville/orion/charts/orion  (version X.Y.Z)
```

The chart lives in `deploy/helm/orion`. Image tags default to the chart's
`appVersion`, so an install needs no tag wiring:

```bash
helm install orion oci://ghcr.io/isaiah-harville/orion/charts/orion \
  --namespace apps --version 0.2.0
```

`api`, `nexrad`, and `gui` are separate Deployments. `api` is stateless and scales
horizontally (`api.replicaCount`); `nexrad` is pinned to one replica because each
producer independently downloads every station's volume and renders the same
global pyramid — a second one doubles NOAA egress for a frame the first already
published. Make frames faster by giving that pod more CPU and raising
`ORION_RADAR_INGEST_WORKERS` / `ORION_RADAR_COMPUTE_WORKERS`.

Because `nexrad` writes the frame directory that every `api` pod reads, the chart
requires a **ReadWriteMany** volume and refuses to render without one. Disk use is
bounded by the producer's own retention, not by the volume size: it keeps
`ORION_RADAR_RETAINED_FRAMES` frames (13 by default), deletes each Level II volume
as soon as it is decoded, and prunes anything older than
`ORION_RADAR_RAW_RETENTION_SECONDS`.

## NEXRAD Mosaic

ORION produces its own animated base-reflectivity mosaic from synchronized NOAA
NEXRAD Level II volumes. The `nexrad` service downloads unsigned archive
objects, selects the lowest usable elevation sweep, resolves radar overlap by beam
altitude/range/scan age, and atomically publishes immutable XYZ PNG tiles. FastAPI
serves the resulting frame manifest and tiles without performing radar processing
inside request workers.

The default configuration in `.env.example` is a 2 km Tennessee Valley mosaic.
Change `ORION_RADAR_STATIONS` and `ORION_RADAR_BOUNDS` together when expanding the
coverage area. Higher resolution and larger bounds increase memory, download,
processing, and tile-storage requirements substantially.

The two services ship as separate images built from `deploy/Dockerfile`: the `api`
target installs only the serving stack, while the `nexrad` target carries the ingest
chain (pyart, rasterio, scipy). Start them together:

```bash
docker compose up --build api nexrad
```

Produce one reproducible frame instead of running the polling loop:

```bash
docker compose run --rm nexrad \
  orion-nexrad --once --analysis-time 2026-08-29T18:00:00Z
```

Radar endpoints:

```text
GET /nexrad/frames
GET /nexrad/status
GET /nexrad/tiles/{frame}/{z}/{x}/{y}.png
```

Tiles are derived, colorized ORION products. Attribution must read: `Weather
radar: NOAA/NWS NEXRAD processed by ORION`. The mosaic remains observational
decision-support data and should expose stale or incomplete source coverage to
operators rather than implying uninterrupted official NOAA delivery.


## [LICENSE](./LICENSE)
