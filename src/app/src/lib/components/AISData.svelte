<script lang="ts">
    import { onDestroy } from 'svelte';
    import { aisStore } from '$lib/stores/aisStore';
    import { Button } from '$lib/components/ui/button';
    import {
      Collapsible,
      CollapsibleTrigger,
      CollapsibleContent
    } from '$lib/components/ui/collapsible';
    import ChevronUp from "@lucide/svelte/icons/chevron-up";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import { flyAndScale } from '$lib/utils';
  
    let selectedShip = null;
  
    const unsubscribe = aisStore.subscribe(store => {
      selectedShip = store.selectedShip;
    });
  
    onDestroy(unsubscribe);
  </script>
  
  {#if selectedShip}
    <div transition:flyAndScale class="bg-neutral-900 border shadow-lg rounded-lg p-4 max-w-sm text-white">
      <!-- Header Section -->
      <div class="flex flex-col space-y-2">
        <h2 class="text-xl font-bold">SHIP ID: {selectedShip.name})</h2>
        <div class="text-gray-400 text-sm">
          Coordinates: {selectedShip.lat.toFixed(5)}, {selectedShip.lon.toFixed(5)}
        </div>
      </div>
  
      <!-- Collapsible AIS Data Details -->
      <div class="mt-4">
        <Collapsible open={true}>
          <CollapsibleTrigger asChild class="w-full">
            <Button variant="ghost" class="w-full flex justify-between items-center border border-gray-700 rounded p-2 text-sm font-medium">
              <span>AIS DATA</span>
              <ChevronUp class="w-4 h-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div class="mt-2 border border-gray-700 rounded p-2 text-sm grid grid-cols-2 gap-2">
              <div><strong>Latitude:</strong> {selectedShip.lat}</div>
              <div><strong>Longitude:</strong> {selectedShip.lon}</div>
              <div><strong>Speed:</strong> {selectedShip.speed} knots</div>
              <div><strong>Heading:</strong> {selectedShip.heading}°</div>
            </div>
          </CollapsibleContent>
        </Collapsible>
  
        <Button
          onclick={() => console.log("START TRACKING AIS clicked")}
          variant="ghost"
          class="w-full mt-2 border border-gray-700 bg-[#3cc76f] hover:bg-[#3cc76f]/70 border-[#5fe390] hover:text-black text-black rounded p-2 text-sm font-medium"
        >
          START TRACKING AIS
        </Button>
      </div>
    </div>
  {:else}
    <div class="bg-neutral-900 border shadow-lg rounded-lg p-4 max-w-sm text-white">
      <p>No AIS ship selected.</p>
    </div>
  {/if}
  
  <style>
    /* Additional styling if needed */
  </style>
  