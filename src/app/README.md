# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Install dependencies and start the development server from the repository root:

```bash
pnpm install
pnpm run dev

# or start only the frontend and open it in a new browser tab
pnpm --filter app dev -- --open
```

The root command starts the frontend, FastAPI, and radar producer. The filtered
command starts only the frontend and expects `VITE_API_URL` to point at an existing
API.

## Building

To create a production version of your app:

```bash
pnpm run build
```

You can preview the production build with `pnpm --filter app preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
