<script lang="ts">
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
  // Sample data; later these could be passed as props or connected to stores
  let vesselName = "Vessel Name";
  let combatStatus = "Neutral"; // options: Neutral, Friendly, Enemy
  let vesselId = "ID: 12345";

  let trackData = {
    altitude: '300m',
    domain: 'Land',
    heading: 'North',
    speed: '20kn',
    location: 'Lat: 123, Long: 456',
    lastUpdated: 'Just now',
    destination: 'Port X',
    callsign: 'ABC123',
    length: '100m'
  };

  // Dropdown options with color classes (using Tailwind for dark mode)
  const statusOptions = [
    { label: 'Neutral', value: 'Neutral', color: 'text-gray-400' },
    { label: 'Friendly', value: 'Friendly', color: 'text-green-500' },
    { label: 'Enemy', value: 'Enemy', color: 'text-red-500' }
  ];

  let value = "Neutral";

  // Derive the selected combat status label and color
  $: selectedStatus = statusOptions.find((option) => option.value === value) || statusOptions[0];

  // State for the collapsible section
  let isTrackDataOpen = true;
</script>

<div class="bg-background shadow-lg rounded-lg p-4 max-w-sm text-white">
  <!-- Top Section -->
  <div class="flex flex-col space-y-2">
    <h2 class="text-xl font-bold">{vesselName}</h2>
    <div class="flex items-center space-x-2">
      <span class="text-sm font-medium">Combat Status:</span>

      <Select.Root type="single" bind:value>
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
    <Collapsible open={isTrackDataOpen} on:openChange={(e) => isTrackDataOpen = e.detail}>
      <CollapsibleTrigger asChild class="w-full">
        <Button variant="ghost" class="w-full flex justify-between items-center border border-gray-700 rounded p-2 text-sm font-medium">
          <span>TRACK DATA</span>
          {#if isTrackDataOpen}
            <ChevronUp class="w-4 h-4" />
          {:else}
            <ChevronDown class="w-4 h-4" />
          {/if}
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
          <div class="col-span-2"><strong>Length:</strong> {trackData.length}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <Button variant="ghost" class="w-full mt-2 border border-gray-700 bg-yellow-400 hover:bg-yellow-500 hover:text-black text-black rounded p-2 text-sm font-medium">TASK</Button>
  </div>
</div>

<style>
  /* Additional dark-mode styling adjustments can be made here if needed */
</style>
