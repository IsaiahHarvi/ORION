<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { current_lat_long } from '$lib/stores/current-location';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';
	import { map_style_state } from '$lib/runes/map-style.svelte';
	import type { Map } from 'maplibre-gl';
	import { Button, Input, Select, Sheet, Switch, Tabs, Toolbar, toast } from '@sivir-ui/svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Layers from '@lucide/svelte/icons/layers';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';

	type View = 'radar' | 'uav' | 'quakes';

	let { map, radarView }: { map: Map; radarView: boolean } = $props();

	const views = [
		{ value: 'radar', label: 'Radar', href: '/' },
		{ value: 'uav', label: 'UAV', href: '/uav' },
		{ value: 'quakes', label: 'Quakes', href: '/quakes' }
	] as const;

	let coordinates = $state('');
	let configOpen = $state(false);
	let viewsOpen = $state(false);
	let selectedStyle = $state(map_style_state.data === 'neon' ? 'neon' : 'dark');
	let currentView: View = $derived(viewFromPath(page.url.pathname));
	let selectedView = $state<View>(viewFromPath(page.url.pathname));
	let currentViewLabel = $derived(
		views.find((view) => view.value === currentView)?.label ?? 'Radar'
	);

	function viewFromPath(pathname: string): View {
		return pathname === '/uav' ? 'uav' : pathname === '/quakes' ? 'quakes' : 'radar';
	}

	afterNavigate(() => {
		selectedView = viewFromPath(page.url.pathname);
	});

	$effect(() => {
		if (selectedStyle !== map_style_state.data) {
			map_style_state.data = selectedStyle;
		}
	});

	$effect(() => {
		if (selectedView !== currentView) {
			const target = views.find((view) => view.value === selectedView);
			if (target) navigate(target.href);
		}
	});

	function navigate(href: '/' | '/uav' | '/quakes') {
		viewsOpen = false;
		if (href !== page.url.pathname) void goto(resolve(href));
	}

	function handleCoordinateKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		const match = coordinates.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
		if (!match) {
			toast.error('Please enter valid coordinates (e.g., 33.54, -117.6).');
			return;
		}

		map.flyTo({ center: [Number(match[3]), Number(match[1])], zoom: 16 });
		configOpen = false;
	}

	function locate() {
		navigator.geolocation.getCurrentPosition(
			({ coords }) => {
				current_lat_long.set({ lat: coords.latitude, long: coords.longitude });
				map.flyTo({
					center: [coords.longitude, coords.latitude],
					zoom: Math.max(map.getZoom(), 12)
				});
			},
			() => toast.error('Unable to access your current location.')
		);
	}
</script>

<Toolbar
	aria-label="Map commands"
	class="orion-surface absolute top-[18px] left-5 z-40 hidden flex-nowrap gap-2.5 rounded-[var(--radius-xl)] lg:flex"
>
	<Tabs.Root bind:value={selectedView} variant="segmented">
		<Tabs.List>
			{#each views as view (view.value)}
				<Tabs.Trigger value={view.value}>{view.label}</Tabs.Trigger>
			{/each}
		</Tabs.List>
	</Tabs.Root>
	<span class="bg-border h-[22px] w-px" aria-hidden="true"></span>
	<Button
		variant={layers_state.data.radar_layer ? 'secondary' : 'ghost'}
		class={layers_state.data.radar_layer ? '' : 'text-foreground-muted'}
		onclick={() => (layers_state.data.radar_layer = !layers_state.data.radar_layer)}
		aria-pressed={layers_state.data.radar_layer}
	>
		<span
			class="size-1.5 rounded-full {layers_state.data.radar_layer
				? 'bg-primary'
				: 'bg-border-strong'}"
		></span>
		Radar
	</Button>
	<Button
		variant={layers_state.data.radar_stations_layer ? 'secondary' : 'ghost'}
		class={layers_state.data.radar_stations_layer ? '' : 'text-foreground-muted'}
		onclick={() =>
			(layers_state.data.radar_stations_layer = !layers_state.data.radar_stations_layer)}
		aria-pressed={layers_state.data.radar_stations_layer}
	>
		<span
			class="size-1.5 rounded-full {layers_state.data.radar_stations_layer
				? 'bg-primary'
				: 'bg-border-strong'}"
		></span>
		Stations
	</Button>
	<span class="bg-border h-[22px] w-px" aria-hidden="true"></span>
	<Input
		aria-label="Coordinates"
		placeholder="33.54, -117.6"
		variant="outline"
		class="!min-h-[34px] w-[150px] font-mono text-[13px]"
		bind:value={coordinates}
		onkeydown={handleCoordinateKeydown}
	/>
	<Select.Root bind:value={selectedStyle}>
		<Select.Trigger aria-label="Map style" class="h-[34px] w-[92px]">
			<span>{selectedStyle === 'neon' ? 'Neon' : 'Dark'}</span>
		</Select.Trigger>
		<Select.Content>
			<Select.Item value="dark" label="Dark">Dark</Select.Item>
			<Select.Item value="neon" label="Neon">Neon</Select.Item>
		</Select.Content>
	</Select.Root>
</Toolbar>

<div
	class="orion-mobile-top pointer-events-none absolute inset-x-3 z-40 flex items-center justify-end lg:hidden"
>
	<Button
		variant="outline"
		class="orion-surface text-foreground-muted pointer-events-auto h-[38px] rounded-xl"
		onclick={() => (viewsOpen = true)}
		aria-label="Change view"
	>
		{currentViewLabel}
		<ChevronDown size={16} />
	</Button>
</div>

<div
	class="absolute right-3 z-40 flex flex-col gap-2 lg:hidden"
	class:bottom-[150px]={radarView}
	class:bottom-[34px]={!radarView}
>
	<Button
		variant="outline"
		size="icon"
		class="orion-surface size-11 rounded-xl"
		onclick={() => (configOpen = true)}
		aria-label="Open layers"
	>
		<Layers size={18} />
	</Button>
	<Button
		variant="outline"
		size="icon"
		class="orion-surface size-11 rounded-xl"
		onclick={locate}
		aria-label="Center on current location"
	>
		<LocateFixed size={18} />
	</Button>
</div>

<Sheet.Root bind:open={configOpen}>
	<Sheet.Content side="left">
		<Sheet.Header>
			<Sheet.Title>Map settings</Sheet.Title>
			<Sheet.Description>Configure the map display and visible data layers.</Sheet.Description
			>
		</Sheet.Header>

		<div class="flex flex-col gap-5">
			<Select.Root bind:value={selectedStyle}>
				<Select.Trigger aria-label="Map style" class="w-full">
					<span>{selectedStyle === 'neon' ? 'Neon' : 'Dark'}</span>
				</Select.Trigger>
				<Select.Content>
					<Select.Label>Map style</Select.Label>
					<Select.Item value="dark" label="Dark">Dark</Select.Item>
					<Select.Item value="neon" label="Neon">Neon</Select.Item>
				</Select.Content>
			</Select.Root>

			<Switch
				bind:switched={layers_state.data.radar_layer}
				label="Weather radar"
				description="Show the current precipitation layer."
			/>
			<Switch
				bind:switched={layers_state.data.radar_stations_layer}
				label="Radar stations"
				description="Show selectable radar station markers."
			/>

			<Input
				label="Coordinates"
				description="Press Enter to center the map."
				placeholder="33.54, -117.6"
				class="font-mono"
				bind:value={coordinates}
				onkeydown={handleCoordinateKeydown}
			/>

			{#if layers_state.data.radar_layer}
				<div class="border-border flex flex-col gap-2 border-t pt-5">
					<span class="text-foreground-muted text-xs font-medium">Reflectivity dBZ</span>
					<div class="flex items-center gap-2">
						<span class="orion-reflectivity-scale h-1.5 w-28 rounded-full"></span>
						<span class="text-foreground-muted font-mono text-[11px]">20 · 40 · 70</span
						>
					</div>
				</div>
			{/if}
		</div>
	</Sheet.Content>
</Sheet.Root>

<Sheet.Root bind:open={viewsOpen}>
	<Sheet.Content side="right">
		<Sheet.Header>
			<Sheet.Title>Choose a view</Sheet.Title>
			<Sheet.Description>Switch between ORION data sources.</Sheet.Description>
		</Sheet.Header>
		<div class="flex flex-col gap-2">
			{#each views as view (view.value)}
				<Button
					variant={currentView === view.value ? 'secondary' : 'ghost'}
					class="w-full justify-start"
					onclick={() => navigate(view.href)}
				>
					{view.label}
				</Button>
			{/each}
		</div>
	</Sheet.Content>
</Sheet.Root>
