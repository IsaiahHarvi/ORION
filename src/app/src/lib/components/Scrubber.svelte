<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Skeleton, Slider } from '@sivir-ui/svelte';
	import { cursor_data } from '$lib/runes/cursor.svelte';
	import { radar_state } from '$lib/runes/current-radar.svelte';

	let { center }: { center: { lat: number; lng: number } } = $props();

	let nowSeconds = $state(Math.floor(Date.now() / 1000));
	// Playback lives in shared state: the map owns the animation loop, this only
	// reflects and steers it.
	let playing = $derived(radar_state.radar_state.playing);
	let selectedIndex = $derived(
		Math.min(
			Math.round(radar_state.radar_state.position),
			Math.max(radar_state.radar_state.valid_timestamps.length - 1, 0)
		)
	);
	let timestamps: number[] = $derived(
		radar_state.radar_state.valid_timestamps.map((frame) => frame.time)
	);
	let frameCount = $derived(timestamps.length);
	let selectedTimestamp = $derived(timestamps[selectedIndex]);
	let selectedFrame = $derived(radar_state.radar_state.valid_timestamps[selectedIndex]);
	let newestTimestamp = $derived(timestamps[frameCount - 1]);
	let currentTime = $derived(formatTime(selectedTimestamp));
	let offsetMinutes = $derived(
		selectedTimestamp && newestTimestamp
			? Math.round((newestTimestamp - selectedTimestamp) / 60)
			: 0
	);
	let windowMinutes = $derived(
		frameCount > 1 ? Math.round((newestTimestamp - timestamps[0]) / 60) : 0
	);
	let cadenceMinutes = $derived(
		frameCount > 1 ? Math.round((newestTimestamp - timestamps[0]) / 60 / (frameCount - 1)) : 0
	);
	let dataAgeMinutes = $derived(
		newestTimestamp ? Math.max(0, Math.floor((nowSeconds - newestTimestamp) / 60)) : 0
	);
	let dataIsStale = $derived(frameCount > 0 && dataAgeMinutes > 20);
	let freshnessLabel = $derived(
		frameCount === 0
			? 'No radar data'
			: `${dataIsStale ? 'Stale' : 'Live'} · ${dataAgeMinutes < 1 ? '<1m' : `${dataAgeMinutes}m`} old`
	);
	let compactFreshnessLabel = $derived(
		frameCount === 0
			? 'No data'
			: `${dataIsStale ? 'Stale' : 'Live'} ${dataAgeMinutes < 1 ? '<1m' : `${dataAgeMinutes}m`}`
	);

	function formatTime(timestamp?: number): string {
		if (!timestamp) return '--:--';
		return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	function formatCoordinate(
		value: number,
		positive: string,
		negative: string,
		degrees = true,
		precision = 3
	) {
		return `${Math.abs(value).toFixed(precision)}${degrees ? '°' : ''} ${value >= 0 ? positive : negative}`;
	}

	function togglePlayback() {
		if (frameCount > 0) radar_state.radar_state.playing = !playing;
	}

	function scrubTo(index: number) {
		// Scrubbing by hand takes over from playback, as on a video timeline.
		radar_state.radar_state.playing = false;
		radar_state.radar_state.position = index;
		radar_state.radar_state.timestamp = timestamps[index];
	}

	onMount(() => {
		const interval = window.setInterval(() => {
			nowSeconds = Math.floor(Date.now() / 1000);
		}, 5_000);
		const handleKeydown = (event: KeyboardEvent) => {
			if (
				event.code !== 'Space' ||
				event.repeat ||
				event.defaultPrevented ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			) {
				return;
			}

			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'input, textarea, select, button, a, [role="slider"], [contenteditable]'
				)
			) {
				return;
			}

			if (frameCount === 0) return;
			event.preventDefault();
			togglePlayback();
		};

		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.clearInterval(interval);
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<section
	id="radar-scrubber"
	aria-label="Radar timeline"
	class="orion-surface orion-scrubber absolute z-40 flex flex-col gap-2 rounded-[var(--radius-xl)] px-3.5 py-3"
>
	<div class="flex items-center gap-3">
		<Button
			size="icon"
			class="size-10 shrink-0 rounded-xl lg:size-[34px] lg:rounded-[var(--radius-lg)]"
			disabled={frameCount === 0}
			onclick={togglePlayback}
			aria-label={playing ? 'Pause radar animation' : 'Play radar animation'}
			aria-keyshortcuts="Space"
			title={`${playing ? 'Pause' : 'Play'} radar animation (Space)`}
		>
			<svg viewBox="0 0 24 24" class="size-[18px]" aria-hidden="true">
				{#if playing}
					<rect x="6.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
					<rect x="13.5" y="5" width="4" height="14" rx="1.5" fill="currentColor" />
				{:else}
					<path
						d="M7.75 6.15c0-1.48 1.63-2.38 2.88-1.59l8.08 5.1a2.77 2.77 0 0 1 0 4.68l-8.08 5.1c-1.25.79-2.88-.11-2.88-1.59z"
						fill="currentColor"
					/>
				{/if}
			</svg>
		</Button>

		{#if frameCount === 0}
			<Skeleton class="h-6 w-[58px] shrink-0 rounded-md" />
			<Skeleton class="h-1 w-full rounded-full" />
		{:else}
			<span class="shrink-0 font-mono text-lg font-medium tabular-nums">{currentTime}</span>
			<Slider
				class="min-w-0 flex-1"
				value={selectedIndex}
				onValueChange={scrubTo}
				min={0}
				max={Math.max(frameCount - 1, 0)}
				step={1}
				label="Radar frame"
			/>
			<span
				class="text-foreground-muted hidden shrink-0 font-mono text-xs tabular-nums lg:block"
			>
				{offsetMinutes === 0 ? 'latest' : `-${offsetMinutes} min`}
			</span>
		{/if}
	</div>

	<div class="text-foreground-muted min-w-0 font-mono text-[10px] leading-none tabular-nums">
		<div class="flex items-center whitespace-nowrap lg:hidden">
			<span class={dataIsStale ? 'text-destructive' : frameCount > 0 ? 'text-success' : ''}>
				{compactFreshnessLabel}
			</span>
			<span class="border-border ml-2 border-l pl-2">
				{frameCount}F · {selectedFrame?.stations.length ??
					0}/{selectedFrame?.configuredStationCount ?? 0} sites
			</span>
			<span class="ml-auto hidden pl-2 min-[360px]:inline">
				{formatCoordinate(center.lat, 'N', 'S', false, 2)} · {formatCoordinate(
					center.lng,
					'E',
					'W',
					false,
					2
				)}
			</span>
		</div>
		<div class="hidden items-center whitespace-nowrap lg:flex">
			<span class={dataIsStale ? 'text-destructive' : frameCount > 0 ? 'text-success' : ''}>
				{freshnessLabel}
			</span>
			<span class="border-border ml-2 border-l pl-2">
				{frameCount} frames · {selectedFrame?.stations.length ??
					0}/{selectedFrame?.configuredStationCount ?? 0} sites
			</span>
			{#if windowMinutes > 0}
				<span class="border-border ml-2 border-l pl-2">
					{windowMinutes}m window{cadenceMinutes > 0 ? ` · ${cadenceMinutes}m steps` : ''}
				</span>
			{/if}
			<span class="ml-auto pl-2">
				{formatCoordinate(cursor_data.lat, 'N', 'S')} · {formatCoordinate(
					cursor_data.lng,
					'E',
					'W'
				)}
			</span>
		</div>
	</div>
</section>
