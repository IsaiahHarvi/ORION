<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import Map from '$lib/components/Map.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { page } from '$app/state';

	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import Toolbar from '$lib/components/Toolbar.svelte';
	let { children } = $props();
</script>

<Toaster />

<!--
    Do not remove this. For some insanely odd reason not importing Map 
    causes the map to bug out completely. Idk wtf is going on
    I am not hallucinating
-->
{#if false}
	<Map />
{/if}

<svelte:head>
	<title>ORION - Observation, Reconnaissance, Intelligence, and Operations Network</title>
</svelte:head>

<div class="flex h-screen w-screen flex-row overflow-hidden bg-[#0d0d0c]">
    <Sidebar />
	<Topbar />
	<div class="flex h-full w-full items-center justify-center overflow-hidden lg:relative">
		{#if page.url.pathname === '/'}
			<div class="flex h-full w-full items-center justify-center lg:relative">
				<!--
                <Toolbar />
                -->
				<Timeline />
			</div>
		{/if}

		{@render children?.()}
	</div>
</div>
