<script lang="ts">
    import Map from '$lib/components/map.svelte';
    import AISData from '$lib/components/AISData.svelte';
	import { onMount } from 'svelte';
	import { layers_state } from '$lib/runes/toggleable_layers.svelte';

    onMount(() => {
        layers_state.data.uav_layer = false;
        layers_state.data.ais_layer = true;
    })
</script>

<!-- Turn off radar if desired -->
<Map />

<div class="absolute w-screen z-20 left-0 px-4 top-4">
    <AISData />
</div>

