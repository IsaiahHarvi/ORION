<script lang="ts">
  import { onDestroy } from 'svelte';
  import { trackDataStore, combatStatusStore } from '$lib/stores/trackData';
  import { startTrackDataPolling } from '$lib/trackDataUpdater';

  import { Button } from '$lib/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
  } from '$lib/components/ui/dropdown-menu';
  import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent
  } from '$lib/components/ui/collapsible';
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import * as Select from "$lib/components/ui/select/index.js";

  let vesselName = "Vessel Name";
  let vesselId = "ID: 12345";

  // trackData now includes "selected?: boolean"
  let trackData = {
    altitude: 'N/A',
    domain: 'N/A',
    heading: 'N/A',
    speed: 'N/A',
    location: 'N/A',
    lastUpdated: 'N/A',
    destination: 'N/A',
    callsign: 'N/A',
    length: 'N/A',
    combatStatus: 'Neutral',
    selected: false
  };

  const statusOptions = [
    { label: 'Neutral', value: 'Neutral', color: 'text-gray-400' },
    { label: 'Friendly', value: 'Friendly', color: 'text-green-500' },
    { label: 'Enemy', value: 'Enemy', color: 'text-red-500' }
  ];

  let combatStatusValue: 'Neutral' | 'Friendly' | 'Enemy';
  combatStatusStore.subscribe(value => {
    combatStatusValue = value;
  });

  // Update combatStatusStore when user picks a new status
  $: combatStatusStore.set(combatStatusValue);

  // Subscribe to trackDataStore updates
  const unsubscribe = trackDataStore.subscribe((data) => {
    if (data) {
      trackData = {
        altitude: data.location ? `${data.location.alt}m` : 'N/A',
        domain: 'N/A',
        heading: data.vehicleAttitude ? `${data.vehicleAttitude.heading}°` : 'N/A',
        speed: 'N/A',
        location: data.location ? `Lat: ${data.location.lat}, Long: ${data.location.lon}` : 'N/A',
        lastUpdated: data.lastUpdated || 'N/A',
        destination: 'N/A',
        callsign: data.callsign || 'N/A',
        length: 'N/A',
        combatStatus: data.combatStatus || 'Neutral',
        selected: data.selected ?? false  // Ensure we preserve the existing 'selected' property
      };
      vesselId = data.vesselId || vesselId;
    }
  });

  startTrackDataPolling();

  $: selectedStatus = statusOptions.find(option => option.value === combatStatusValue) || statusOptions[0];

  onDestroy(() => {
    unsubscribe();
  });
</script>

<!-- We only show the track data overlay if trackData.selected == true -->
{#if trackData.selected}
<div class="bg-background shadow-lg rounded-lg p-4 max-w-sm text-white">
  <!-- Top Section -->
  <div class="flex flex-col space-y-2">
    <h2 class="text-xl font-bold">{vesselName}</h2>
    <div class="flex items-center space-x-2">
      <span class="text-sm font-medium">Combat Status:</span>
      <Select.Root type="single" bind:value={combatStatusValue}>
        <Select.Trigger class="w-[180px]">
          <span class={selectedStatus.color}>{selectedStatus.label}</span>
        </Select.Trigger>
        <Select.Content class="bg-background text-white">
          <Select.Group>
            <Select.GroupHeading>Combat Status</Select.GroupHeading>
            {#each statusOptions as option}
              <Select.Item value={option.value}>
                <span class={option.color}>{option.label}</span>
              </Select.Item>
            {/each}
          </Select.Group>
        </Select.Content>
      </Select.Root>
    </div>
    <div class="text-gray-400 text-sm">{vesselId}</div>
  </div>

  <!-- Collapsible TRACK DATA Section -->
  <div class="mt-4">
    <Collapsible open={true}>
      <CollapsibleTrigger asChild class="w-full">
        <Button variant="ghost" class="w-full flex justify-between items-center border border-gray-700 rounded p-2 text-sm font-medium">
          <span>TRACK DATA</span>
          <ChevronUp class="w-4 h-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="mt-2 border border-gray-700 rounded p-2 text-sm grid grid-cols-2 gap-2">
          <div><strong>Altitude:</strong> {trackData.altitude}</div>
          <div><strong>Domain:</strong> {trackData.domain}</div>
          <div><strong>Heading:</strong> {trackData.heading}</div>
          <div><strong>Speed:</strong> {trackData.speed}</div>
          <div><strong>Location:</strong> {trackData.location}</div>
          <div><strong>Last Updated:</strong> {trackData.lastUpdated}</div>
          <div><strong>Destination:</strong> {trackData.destination}</div>
          <div><strong>Callsign:</strong> {trackData.callsign}</div>
          <div class="col-span-2"><strong>Combat Status:</strong> {trackData.combatStatus}</div>
          <div class="col-span-2"><strong>Length:</strong> {trackData.length}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
    <Button variant="ghost" class="w-full mt-2 border border-gray-700 bg-yellow-400 hover:bg-yellow-500 hover:text-black text-black rounded p-2 text-sm font-medium">
      START TRACKING
    </Button>
  </div>
</div>
{/if}
