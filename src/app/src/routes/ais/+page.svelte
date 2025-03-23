<script lang="ts">
    import Map from '$lib/components/map.svelte';
    import AISData from '$lib/components/AISData.svelte';
    let mapInstance;
</script>

<!-- Turn off radar if desired -->
<Map bind:map={mapInstance} showRadarLayer={false} showAISLayer={true} />

{#if mapInstance}
    <!-- Note: AISLayer is now rendered from within Map.svelte when showAISLayer is true -->
{/if}

<div class="absolute z-20 top-4 left-4">
    <AISData />
</div>
