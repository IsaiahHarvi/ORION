import { vi } from 'vitest';

// SvelteKit serves $env/dynamic/public through a global the server injects into
// the page; jsdom has no such global, so the import resolves to undefined here.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
