<script lang="ts">
	import type { RadarStation } from './RadarLayer.svelte';
	import { Button, Card } from '@sivir-ui/svelte';
	import X from '@lucide/svelte/icons/x';

	let {
		station,
		onclose,
		oncenter,
		onframes
	}: {
		station: RadarStation;
		onclose: () => void;
		oncenter: () => void;
		onframes: () => void;
	} = $props();
</script>

<Card.Root
	variant="panel"
	class="absolute top-[104px] right-3 left-3 z-40 lg:top-[76px] lg:right-5 lg:bottom-auto lg:left-auto lg:w-[300px] [&_[data-ui=card-surface]]:gap-3.5 [&_[data-ui=card-surface]]:p-4"
>
	<div class="flex items-start justify-between gap-2.5">
		<div class="flex min-w-0 flex-col gap-0.5">
			<h2 class="text-base font-semibold tracking-[-0.015em]">{station.radar_id}</h2>
			<span class="text-foreground-muted truncate font-mono text-xs">
				{station.lat.toFixed(3)}, {station.lon.toFixed(3)}
			</span>
		</div>
		<Button
			variant="ghost"
			size="icon"
			class="-mt-2 -mr-2 size-9"
			onclick={onclose}
			aria-label="Close station details"
		>
			<X size={16} />
		</Button>
	</div>

	<div class="grid grid-cols-2 gap-x-3.5 gap-y-2.5 text-[13px]">
		<div class="flex flex-col gap-0.5">
			<span class="text-foreground-muted">Range</span>
			<span class="font-mono tabular-nums">{station.distance.toFixed(0)} km</span>
		</div>
		<div class="flex flex-col gap-0.5">
			<span class="text-foreground-muted">Elevation</span>
			<span class="text-foreground-muted font-mono">Unavailable</span>
		</div>
		<div class="flex flex-col gap-0.5">
			<span class="text-foreground-muted">Last sweep</span>
			<span class="text-foreground-muted font-mono">Unavailable</span>
		</div>
		<div class="flex flex-col gap-0.5">
			<span class="text-foreground-muted">Peak dBZ</span>
			<span class="text-foreground-muted font-mono">Unavailable</span>
		</div>
	</div>

	<div class="flex gap-2">
		<Button class="flex-1" onclick={oncenter}>Center map</Button>
		<Button class="flex-1" variant="outline" onclick={onframes}>Frames</Button>
	</div>
</Card.Root>
