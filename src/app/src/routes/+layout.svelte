<script lang="ts">
	import { onMount, setContext } from 'svelte';
    import Sidebar from '$lib/components/sidebar.svelte';
    import Topbar from '$lib/components/topbar.svelte';
    import { Button } from '$lib/components/ui/button'
	import Map from '$lib/components/map.svelte';
	import Timeline from '$lib/components/timeline.svelte';
    import { page } from '$app/state';

	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import Toolbar from '$lib/components/toolbar.svelte';
	let { children } = $props();
    let map = $state();
</script>

<Toaster />

<svelte:head>
    <title>
        ORION - Observation, Reconnaissance, Intelligence, and Operations Network
    </title>
</svelte:head>

<div class="flex flex-row h-screen bg-[#0d0d0c] w-screen overflow-hidden">
    <Sidebar />
    <Topbar />
    <div class="lg:relative overflow-hidden flex items-center justify-center h-full w-full">
        {#if page.url.pathname === "/"}
            <div class="lg:relative flex items-center justify-center h-full w-full">
                <Toolbar />
                <Timeline />
            </div>
        {/if}

        {@render children?.()}
    </div>
</div>
