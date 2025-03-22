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


        console.log(targetDiv)
        if (targetDiv) {
            console.log("Removing")
            targetDiv.remove();
        }
    })
</script>

<div class="flex flex-row h-screen w-screen overflow-hidden">
    <Sidebar />
    <div class="lg:relative flex items-center justify-center h-full w-full">
        <!--
            <Topbar />
        -->
        {@render children?.()}
    </div>
</div>
