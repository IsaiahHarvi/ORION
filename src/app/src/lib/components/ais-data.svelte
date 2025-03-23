<script lang="ts">
    import { aisStore } from '$lib/stores/aisStore';
</script>

<div class="p-4 bg-black bg-opacity-50 rounded text-white">
    {#if $aisStore.selectedShip}
        <h2>{$aisStore.selectedShip.name}</h2>
        <p>MMSI: {$aisStore.selectedShip.mmsi}</p>
        <p>Speed: {$aisStore.selectedShip.speed} knots</p>
        <p>Heading: {$aisStore.selectedShip.heading}°</p>
    {:else}
        <p>Select a ship on the map.</p>
    {/if}
</div>
