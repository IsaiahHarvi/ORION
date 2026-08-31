<script lang="ts">
	import '../app.css';
	import { Toaster } from '@sivir-ui/svelte';
	import Map from '$lib/components/Map.svelte';

	let { children } = $props();
</script>

<Toaster />
<main class="bg-background relative h-screen w-screen overflow-hidden">
	<Map />
	{@render children?.()}
</main>
