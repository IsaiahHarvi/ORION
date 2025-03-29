<script lang="ts">
	import { onDestroy } from 'svelte';
	import { trackDataStore, combatStatusStore } from '$lib/stores/track-data';
	import { startTrackDataPolling } from '$lib/track-data-updater';

	import * as Select from '$lib/components/ui/select/index.js';
	import X from '@lucide/svelte/icons/x';
	import { flyAndScale } from '$lib/utils';

	let vesselId = 'ID: 12345';

	let trackData = {
		latitude: 'N/A',
		longitude: 'N/A',
		altitude: 'N/A',
		lastUpdated: 'N/A',
		callsign: 'N/A',
		combatStatus: 'Neutral',
		selected: false,
		platformHeading: 'N/A',
		platformPitch: 'N/A',
		platformRoll: 'N/A',
		cameraHFOV: 'N/A',
		cameraVFOV: 'N/A',
		cameraYaw: 'N/A',
		cameraPitch: 'N/A',
		cameraRoll: 'N/A'
	};

	const statusOptions = [
		{ label: 'Neutral', value: 'Neutral', color: 'text-muted-foreground' },
		{ label: 'Friendly', value: 'Friendly', color: 'text-green-500' },
		{ label: 'Enemy', value: 'Enemy', color: 'text-red-500' }
	];
	let combatStatusValue: 'Neutral' | 'Friendly' | 'Enemy';

	combatStatusStore.subscribe((value) => {
		combatStatusValue = value;
	});

	$: combatStatusStore.set(combatStatusValue);

	const unsubscribe = trackDataStore.subscribe((data) => {
		if (!data) return;

		let latStr = 'N/A';
		let lonStr = 'N/A';
		let altStr = 'N/A';
		if (data.location) {
			latStr = data.location.lat.toFixed(5);
			lonStr = data.location.lon.toFixed(5);
			altStr = `${data.location.alt?.toFixed(1)}m`;
		}

		const pHeading = data.vehicleAttitude?.heading?.toFixed(1) ?? 'N/A';
		const pPitch = data.vehicleAttitude?.pitch?.toFixed(1) ?? 'N/A';
		const pRoll = data.vehicleAttitude?.roll?.toFixed(1) ?? 'N/A';

		const hfovStr = data.cameraFOV?.hfov?.toFixed(2) ?? 'N/A';
		const vfovStr = data.cameraFOV?.vfov?.toFixed(2) ?? 'N/A';

		const cYaw = data.cameraGimbalAttitude?.yaw?.toFixed(1) ?? 'N/A';
		const cPitch = data.cameraGimbalAttitude?.pitch?.toFixed(1) ?? 'N/A';
		const cRoll = data.cameraGimbalAttitude?.roll?.toFixed(1) ?? 'N/A';

		trackData = {
			latitude: latStr,
			longitude: lonStr,
			altitude: altStr,
			lastUpdated: data.lastUpdated || 'N/A',
			callsign: data.callsign || 'N/A',
			combatStatus: data.combatStatus || 'Neutral',
			selected: data.selected ?? false,
			platformHeading: pHeading + '°',
			platformPitch: pPitch + '°',
			platformRoll: pRoll + '°',
			cameraHFOV: hfovStr + '°',
			cameraVFOV: vfovStr + '°',
			cameraYaw: cYaw + '°',
			cameraPitch: cPitch + '°',
			cameraRoll: cRoll + '°'
		};

		vesselId = data.vesselId || vesselId;
	});

	startTrackDataPolling();

	$: selectedStatus =
		statusOptions.find((option) => option.value === combatStatusValue) || statusOptions[0];

	onDestroy(() => {
		unsubscribe();
	});
</script>

{#if trackData.selected}
	<div
		transition:flyAndScale
		class="pointer-events-auto relative mt-16 w-full rounded-lg border bg-background p-4 text-white lg:w-[27.5rem]"
	>
		<button
			class="absolute right-4 top-4"
			onclick={() => {
				trackDataStore.update((d) => ({ ...d, selected: false }));
			}}
		>
			<X class="text-white/70 duration-200 hover:text-white/40" size={18} />
		</button>
		<div class="flex flex-col space-y-2">
			<h2 class="text-lg">{trackData.callsign}</h2>
			<div class="flex items-center space-x-2">
				<span class="text-sm">Combat Status:</span>
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
			<div class="text-sm text-muted-foreground">{vesselId}</div>
		</div>

		<div class="mt-4">
			<div class="my-2 grid grid-cols-2 gap-2 text-sm">
				<div><strong>Latitude:</strong> {trackData.latitude}</div>
				<div><strong>Longitude:</strong> {trackData.longitude}</div>
				<div><strong>Altitude:</strong> {trackData.altitude}</div>
				<div><strong>Last Updated:</strong> {trackData.lastUpdated}</div>
				<div><strong>Callsign:</strong> {trackData.callsign}</div>
				<div class="col-span-2">
					<strong>Combat Status:</strong>
					{trackData.combatStatus}
				</div>

				<div class="col-span-2 mt-2 border-t pt-2"><strong>Platform Attitude</strong></div>
				<div><strong>Heading:</strong> {trackData.platformHeading}</div>
				<div><strong>Pitch:</strong> {trackData.platformPitch}</div>
				<div><strong>Roll:</strong> {trackData.platformRoll}</div>

				<div class="col-span-2 mt-2 border-t pt-2"><strong>Camera FOV</strong></div>
				<div><strong>HFOV:</strong> {trackData.cameraHFOV}</div>
				<div><strong>VFOV:</strong> {trackData.cameraVFOV}</div>

				<div class="col-span-2 mt-2 border-t pt-2"><strong>Camera Orientation</strong></div>
				<div><strong>Yaw:</strong> {trackData.cameraYaw}</div>
				<div><strong>Pitch:</strong> {trackData.cameraPitch}</div>
				<div><strong>Roll:</strong> {trackData.cameraRoll}</div>
			</div>
		</div>
	</div>
{/if}

<style>
</style>
