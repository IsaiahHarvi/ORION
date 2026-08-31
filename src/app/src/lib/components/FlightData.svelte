<script lang="ts">
	import { onDestroy } from 'svelte';
	import { flightStore, type Flight } from '$lib/stores/flight-store';
	import { markerColor, label } from '$lib/adsb-updater';
	import { flyAndScale } from '$lib/utils';
	import X from '@lucide/svelte/icons/x';

	let selectedFlight: Flight | null = $state(null);

	const unsubscribe = flightStore.subscribe((store) => {
		selectedFlight = store.selectedFlight;
	});

	onDestroy(unsubscribe);

	function closePanel() {
		flightStore.update((d) => ({ ...d, selectedFlight: null }));
	}

	function altitude(flight: Flight): string {
		if (flight.on_ground) return 'On ground';
		return flight.altitude_ft !== null
			? `${Math.round(flight.altitude_ft).toLocaleString()} ft`
			: 'N/A';
	}

	function verticalRate(flight: Flight): string {
		if (flight.vertical_rate_fpm === null) return 'Level';
		const rate = Math.round(flight.vertical_rate_fpm);
		if (Math.abs(rate) < 100) return 'Level';
		return `${rate > 0 ? 'Climbing' : 'Descending'} ${Math.abs(rate).toLocaleString()} fpm`;
	}
</script>

{#if selectedFlight}
	<div
		transition:flyAndScale
		class="bg-background relative mt-16 w-full rounded-lg border p-4 text-white shadow-lg lg:w-[27.5rem]"
	>
		<button class="absolute top-4 right-4" onclick={closePanel} aria-label="Close">
			<X class="text-white/70 duration-200 hover:text-white/40" size={18} />
		</button>

		<div class="flex items-center gap-3">
			<span
				class="size-3 shrink-0 rounded-full"
				style="background-color: {markerColor(selectedFlight)}"
			></span>
			<div class="min-w-0">
				<h2 class="truncate font-mono text-lg font-bold">{label(selectedFlight)}</h2>
				<div class="text-foreground-muted text-xs">
					{selectedFlight.aircraft_type ?? 'Unknown type'}
					{#if selectedFlight.registration}
						· {selectedFlight.registration}
					{/if}
				</div>
			</div>
		</div>

		<div class="my-3 grid grid-cols-2 gap-2 text-sm">
			<div><strong>Altitude:</strong> {altitude(selectedFlight)}</div>
			<div>
				<strong>Ground speed:</strong>
				{selectedFlight.ground_speed_kt !== null
					? `${Math.round(selectedFlight.ground_speed_kt)} kt`
					: 'N/A'}
			</div>
			<div>
				<strong>Track:</strong>
				{selectedFlight.track_deg !== null
					? `${Math.round(selectedFlight.track_deg)}°`
					: 'N/A'}
			</div>
			<div><strong>Squawk:</strong> {selectedFlight.squawk ?? 'N/A'}</div>
			<div><strong>Latitude:</strong> {selectedFlight.latitude.toFixed(4)}</div>
			<div><strong>Longitude:</strong> {selectedFlight.longitude.toFixed(4)}</div>
			<div class="col-span-2"><strong>Vertical:</strong> {verticalRate(selectedFlight)}</div>
		</div>

		{#if selectedFlight.emergency}
			<div class="mb-2 rounded bg-red-900/40 px-2 py-1 text-sm text-red-200">
				Emergency squawked: {selectedFlight.emergency}
			</div>
		{/if}

		<div class="text-foreground-muted font-mono text-[11px]">
			ICAO {selectedFlight.id.toUpperCase()}
			{#if selectedFlight.seen_pos_s !== null}
				· position {Math.round(selectedFlight.seen_pos_s)}s old
			{/if}
		</div>
	</div>
{/if}
