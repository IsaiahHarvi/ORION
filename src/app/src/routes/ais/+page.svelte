<script lang="ts">
    import Map from '$lib/components/map.svelte';
    import AISLayer from '$lib/components/AISLayer.svelte';
    import AISData from '$lib/components/AISData.svelte';
    let mapInstance;
</script>

<Map bind:map={mapInstance} showRadarLayer={false} />

{#if mapInstance}
    <AISLayer map={mapInstance} />
{/if}

<div class="absolute z-20 top-4 left-4">
    <AISData />
</div>
