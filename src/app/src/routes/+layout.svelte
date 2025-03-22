<script lang="ts">
	import { onMount, setContext } from 'svelte';
    import Sidebar from '$lib/components/sidebar.svelte';
    import Topbar from '$lib/components/topbar.svelte';
    import { Button } from '$lib/components/ui/button'
	import Map from '$lib/components/map.svelte';
	import Timeline from '$lib/components/timeline.svelte';
    import { page } from '$app/state';

	import '../app.css';
	let { children } = $props();
    let map = $state();

    onMount(() => {
        const targetDiv = document.querySelector('.maplibregl-control-container');

        if (targetDiv) {
            console.log("Removing")
            targetDiv.remove();
        }
    })

    $effect(() => {
        const targetDiv = document.querySelector('.maplibregl-control-container');
        
        if (targetDiv) {
            console.log("Removing")
            targetDiv.remove();
        }
    })
</script>

<svelte:head>
    <title>
        ORION - Observation, Reconnaissance, Intelligence, and Operations Network
    </title>
</svelte:head>

<div class="flex flex-row h-screen bg-[#0d0d0c] w-screen overflow-hidden">
    <Sidebar />
    <div class="lg:relative overflow-hidden flex items-center justify-center h-full w-full">
        <!--
            <Topbar />
        -->
        {@render children?.()}
    </div>
</div>
