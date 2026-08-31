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

Turborepo starts the SvelteKit app, FastAPI service, and Level II radar producer. The
app is available at `http://localhost:5173`, and the API is available at
`http://localhost:5171`. The first radar frame may take several minutes while NOAA
volumes are downloaded and processed.

Local runtime artifacts are written to `data/dev-scans`. Do not run the development
stack with `sudo`; root-owned Vite caches and radar artifacts prevent normal hot
reloads and frame replacement.

Run the backend services individually when needed:

```bash
pnpm run dev:api
pnpm run dev:radar
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

## NEXRAD Mosaic

ORION produces its own animated base-reflectivity mosaic from synchronized NOAA
NEXRAD Level II volumes. The `radar-producer` service downloads unsigned archive
objects, selects the lowest usable elevation sweep, resolves radar overlap by beam
altitude/range/scan age, and atomically publishes immutable XYZ PNG tiles. FastAPI
serves the resulting frame manifest and tiles without performing radar processing
inside request workers.

The default configuration in `.env.example` is a 2 km Tennessee Valley mosaic.
Change `ORION_RADAR_STATIONS` and `ORION_RADAR_BOUNDS` together when expanding the
coverage area. Higher resolution and larger bounds increase memory, download,
processing, and tile-storage requirements substantially.

Start the API and producer together:

```bash
docker compose up --build api radar-producer
```

Produce one reproducible frame instead of running the polling loop:

```bash
docker compose run --rm radar-producer \
  python -m services.radar.producer --once --analysis-time 2026-08-29T18:00:00Z
```

Radar endpoints:

```text
GET /radar/frames
GET /radar/status
GET /radar/tiles/{frame}/{z}/{x}/{y}.png
```

Tiles are derived, colorized ORION products. Attribution must read: `Weather
radar: NOAA/NWS NEXRAD processed by ORION`. The mosaic remains observational
decision-support data and should expose stale or incomplete source coverage to
operators rather than implying uninterrupted official NOAA delivery.


## [LICENSE](./LICENSE)
