import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		allowedHosts: ['orion.harville.dev', 'localhost', '127.0.0.1'],
		host: '0.0.0.0',
		hmr: false,
		port: 5173,
		watch: {
			usePolling: true
		}
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					'svelte-bundle': ['svelte', 'svelte/internal', 'svelte/internal/client']
				}
			}
		}
	}
});
