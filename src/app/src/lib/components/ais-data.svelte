<script lang="ts">
    import { aisStore } from '$lib/stores/aisStore';
    import { flyAndScale } from '$lib/utils';
    import X from '@lucide/svelte/icons/x';

    let selectedShip = null;

    const unsubscribe = aisStore.subscribe(data => {
        selectedShip = data?.selectedShip || null;
    });

    function closePanel() {
        aisStore.update(d => ({ ...d, selectedShip: null }));
    }
</script>

{#if selectedShip}
    <div transition:flyAndScale class="bg-neutral-900 relative mt-16 border shadow-lg rounded-lg p-4 w-full lg:w-[27.5rem] text-white">
        <button class="absolute top-4 right-4" on:click={closePanel}>
            <X class="hover:text-white/40 duration-200 text-white/70" size={18} />
        </button>

        <div class="flex flex-col space-y-2">
            <h2 class="text-xl font-bold">{selectedShip.name || 'Unnamed Vessel'}</h2>
            <div class="text-gray-400 text-sm">MMSI: {selectedShip.mmsi}</div>
        </div>

        <div class="mt-4">
            <div class="grid text-sm my-2 grid-cols-2 gap-2">
                <div><strong>Speed:</strong> {selectedShip.speed ?? 'N/A'} knots</div>
                <div><strong>Heading:</strong> {selectedShip.heading ?? 'N/A'}°</div>
                <div><strong>Latitude:</strong> {selectedShip.lat?.toFixed(5) ?? 'N/A'}</div>
                <div><strong>Longitude:</strong> {selectedShip.lon?.toFixed(5) ?? 'N/A'}</div>
                <div class="col-span-2"><strong>Last Updated:</strong> {selectedShip.lastUpdated ?? 'N/A'}</div>
            </div>
        </div>
    </div>
{/if}
