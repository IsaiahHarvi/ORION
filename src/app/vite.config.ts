import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: ['orion.harville.dev', 'localhost', '127.0.0.1'],
		host: '0.0.0.0',
		port: 5173,
		watch: {
			usePolling: true
		}
	},
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/**/*.{test,spec}.{js,ts}'],
		setupFiles: ['./src/tests/setup/vitest.setup.ts']
	}
});
