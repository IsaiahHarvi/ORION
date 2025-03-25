<script lang="ts">
	import { onMount, setContext } from 'svelte';
    import Sidebar from '$lib/components/SidebarTemp.svelte';
    import Topbar from '$lib/components/Topbar.svelte';
    import { Button } from '$lib/components/ui/button'
	import Map from '$lib/components/MapTemp.svelte';
	import Timeline from '$lib/components/TimelineTemp.svelte';
    import { page } from '$app/state';

	import '../app.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import Toolbar from '$lib/components/Toolbar.svelte';
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
