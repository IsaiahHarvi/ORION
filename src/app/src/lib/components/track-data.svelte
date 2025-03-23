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
  import { flyAndScale } from '$lib/utils';

  let vesselName = "PLATFORM";
  let vesselId = "ID: 12345";

  // We store displayed track data in a local object, separate from the raw store.
  let trackData = {
    latitude: 'N/A',
    longitude: 'N/A',
    altitude: 'N/A',
    lastUpdated: 'N/A',
    callsign: 'N/A',
    combatStatus: 'Neutral',
    selected: false,

    // Extra fields for new data:
    platformHeading: 'N/A',
    platformPitch: 'N/A',
    platformRoll: 'N/A',
    cameraHFOV: 'N/A',
    cameraVFOV: 'N/A',
    cameraYaw: 'N/A',
    cameraPitch: 'N/A',
    cameraRoll: 'N/A'
  };

  // For the combat status dropdown:
  const statusOptions = [
    { label: 'Neutral',  value: 'Neutral',  color: 'text-gray-400' },
    { label: 'Friendly', value: 'Friendly', color: 'text-green-500' },
    { label: 'Enemy',    value: 'Enemy',    color: 'text-red-500' }
  ];
  let combatStatusValue: 'Neutral' | 'Friendly' | 'Enemy';
  combatStatusStore.subscribe(value => {
    combatStatusValue = value;
  });

  // Each time user picks a new status, we update the store:
  $: combatStatusStore.set(combatStatusValue);

  // Subscribe to trackDataStore so we can display everything
  const unsubscribe = trackDataStore.subscribe((data) => {
    if (!data) return;

    // Extract lat/lon/alt if location is present
    let latStr = 'N/A';
    let lonStr = 'N/A';
    let altStr = 'N/A';
    if (data.location) {
      latStr = data.location.lat.toFixed(5);
      lonStr = data.location.lon.toFixed(5);
      altStr = `${data.location.alt?.toFixed(1)}m`;
    }

    // Platform attitude
    const pHeading = data.vehicleAttitude?.heading?.toFixed(1) ?? 'N/A';
    const pPitch   = data.vehicleAttitude?.pitch?.toFixed(1)   ?? 'N/A';
    const pRoll    = data.vehicleAttitude?.roll?.toFixed(1)    ?? 'N/A';

    // Camera FOV
    const hfovStr = data.cameraFOV?.hfov?.toFixed(2) ?? 'N/A';
    const vfovStr = data.cameraFOV?.vfov?.toFixed(2) ?? 'N/A';

    // Final camera orientation
    const cYaw   = data.cameraGimbalAttitude?.yaw?.toFixed(1)   ?? 'N/A';
    const cPitch = data.cameraGimbalAttitude?.pitch?.toFixed(1) ?? 'N/A';
    const cRoll  = data.cameraGimbalAttitude?.roll?.toFixed(1)  ?? 'N/A';

    trackData = {
      latitude: latStr,
      longitude: lonStr,
      altitude: altStr,
      lastUpdated: data.lastUpdated || 'N/A',
      callsign: data.callsign || 'N/A',
      combatStatus: data.combatStatus || 'Neutral',
      selected: data.selected ?? false,

      platformHeading: pHeading + '°',
      platformPitch:   pPitch   + '°',
      platformRoll:    pRoll    + '°',
      cameraHFOV: hfovStr + '°',
      cameraVFOV: vfovStr + '°',
      cameraYaw:   cYaw   + '°',
      cameraPitch: cPitch + '°',
      cameraRoll:  cRoll  + '°'
    };

    vesselId = data.vesselId || vesselId;
  });

  // Start polling sensor data
  startTrackDataPolling();

  // For dropdown display
  $: selectedStatus = statusOptions.find(option => option.value === combatStatusValue) || statusOptions[0];

  onDestroy(() => {
    unsubscribe();
  });
</script>

<!-- Show overlay only if selected -->
{#if trackData.selected}
<div transition:flyAndScale class="bg-neutral-900 border shadow-lg rounded-lg p-4 max-w-sm text-white">
  <!-- Top Section (title & status) -->
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
          <div><strong>Latitude:</strong> {trackData.latitude}</div>
          <div><strong>Longitude:</strong> {trackData.longitude}</div>
          <div><strong>Altitude:</strong> {trackData.altitude}</div>
          <div><strong>Last Updated:</strong> {trackData.lastUpdated}</div>
          <div><strong>Callsign:</strong> {trackData.callsign}</div>
          <div class="col-span-2"><strong>Combat Status:</strong> {trackData.combatStatus}</div>

          <!-- PLATFORM ATTITUDE -->
          <div class="col-span-2 mt-2 border-t pt-2"><strong>Platform Attitude</strong></div>
          <div><strong>Heading:</strong> {trackData.platformHeading}</div>
          <div><strong>Pitch:</strong> {trackData.platformPitch}</div>
          <div><strong>Roll:</strong> {trackData.platformRoll}</div>

          <!-- CAMERA FOV -->
          <div class="col-span-2 mt-2 border-t pt-2"><strong>Camera FOV</strong></div>
          <div><strong>HFOV:</strong> {trackData.cameraHFOV}</div>
          <div><strong>VFOV:</strong> {trackData.cameraVFOV}</div>

          <!-- FINAL CAMERA ORIENTATION -->
          <div class="col-span-2 mt-2 border-t pt-2"><strong>Camera Orientation</strong></div>
          <div><strong>Yaw:</strong> {trackData.cameraYaw}</div>
          <div><strong>Pitch:</strong> {trackData.cameraPitch}</div>
          <div><strong>Roll:</strong> {trackData.cameraRoll}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>

    <Button
      onclick={() => {
        console.log("START TRACKING clicked");
      }}
      variant="ghost"
      class="w-full mt-2 border border-gray-700 bg-[#3cc76f] hover:bg-[#3cc76f]/70 border-[#5fe390] hover:text-black text-black rounded p-2 text-sm font-medium"
    >
      START TRACKING
    </Button>
  </div>
</div>
{/if}

<style>
  /* Additional styling if needed */
</style>
