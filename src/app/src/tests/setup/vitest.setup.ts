import { vi } from 'vitest';

globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
