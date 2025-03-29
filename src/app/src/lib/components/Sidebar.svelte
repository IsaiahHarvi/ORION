<script lang="ts">
	import { page } from '$app/state';
	import Radar from '@lucide/svelte/icons/radar';
	import Globe from '@lucide/svelte/icons/globe';
	import Menu from '@lucide/svelte/icons/menu';
	import * as Sheet from '$lib/components/ui/sheet';
	import { buttonVariants } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { map_style_urls } from '$lib/map-styles';
	import { map_style_state } from '$lib/runes/map-style.svelte';
	import { map_state } from '$lib/runes/map-state.svelte';
	import { layers_state } from '$lib/runes/toggleable-layers.svelte';
	import { toast } from 'svelte-sonner';

	import UAV from '$lib/icons/uav-icon.png';
	import Ship from '$lib/icons/ship-icon.png';

	const tabs = [
		{ name: 'Weather Radar', href: '/', icon: Radar },
		{ name: 'UAV Data', href: '/uav', icon: UAV },
		{ name: 'AIS Data', href: '/ais', icon: Ship }
	];

	let open = $state(false);
	let searchValue = $state('');

	let radarLayersChecked = $derived(layers_state.data.radar_layer);
	let radarStationsChecked = $derived(layers_state.data.radar_stations_layer);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			const regex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
			const match = searchValue.match(regex);
			if (match) {
				const lat = parseFloat(match[1]);
				const lng = parseFloat(match[3]);

				map_state.data.flyTo({ center: [lng, lat], zoom: 16 });
			} else {
				toast('Please enter valid coordinates (e.g., 33.54, -117.6).');
			}
		}
	}

	$effect(() => {
		layers_state.data.radar_layer = radarLayersChecked;
		layers_state.data.radar_stations_layer = radarStationsChecked;
	});
</script>

{#snippet nav_content()}
	<input
		placeholder="e.g. 33.54, -117.6"
		bind:value={searchValue}
		onkeydown={handleKeydown}
		tabindex="-1"
		class="mb-2 mt-1 w-full rounded-md border bg-muted p-3 px-3 font-mono text-sm placeholder:text-muted-foreground/50"
	/>
	<div class="flex w-full flex-col items-start gap-4 py-4 lg:hidden">
        <div class="flex flex-row items-center justify-center gap-3">
            <Checkbox bind:checked={radarLayersChecked} id="radar-layers" />
            <label class=" text-sm text-white" for="radar-layers"> Show Weather Radar </label>
        </div>
        <div class="flex flex-row items-center justify-center gap-3">
            <Checkbox bind:checked={radarStationsChecked} id="radar-stations" />
            <label class=" text-sm text-white" for="radar-stations">
                Show Radar Stations
            </label>
        </div>
	</div>
	<p class="py-3 font-mono text-sm text-muted-foreground">VIEWS</p>
	{#each tabs as tab}
		<a
			href={tab.href}
			class="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors
			{page.url.pathname === tab.href
				? 'bg-muted border font-medium text-white'
				: 'hover:bg-muted border border-transparent hover:border-border duration-300 hover:text-white'}"
			onclick={() => (open = false)}
		>
			<span>{tab.name}</span>
		</a>
	{/each}
	<p class="py-3 font-mono text-sm text-muted-foreground">MAP STYLES</p>
	{#each map_style_urls.slice().sort((a, b) => a.localeCompare(b)) as style}
		<button
			class="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors
			{map_style_state.data === style
				? 'bg-muted border font-medium text-white'
				: 'hover:bg-muted border border-transparent hover:border-border duration-300 hover:text-white'}"
			onclick={() => {
				open = false;
				map_style_state.data = style;
			}}
		>
			<span>{style.charAt(0).toUpperCase() + style.slice(1)}</span>
		</button>
	{/each}
{/snippet}

<div
	class="invisible flex h-screen mt-16 flex-shrink-0 flex-col border-r bg-background px-4 pt-6 lg:visible lg:w-64 xl:w-[20rem]"
>
	<div class="flex flex-col gap-1">
		{@render nav_content()}
	</div>
</div>

<div
	class="fixed left-0 top-0 z-40 flex h-14 w-screen items-center gap-4 border-b bg-background px-4 lg:hidden"
>
	<Sheet.Root bind:open>
		<Sheet.Trigger>
            <button onclick={() => {
                open = !open;
            }} class='rounded-lg hover:bg-muted duration-200 border h-9 w-9 flex items-center justify-center'>
                <Menu size={20} />
            </button>
		</Sheet.Trigger>
		<Sheet.Content side="left" class="w-[75%] px-4 py-6">
            <header class="flex mb-6 flex-row items-center gap-4">
                <h1>
                    ORION
                </h1>
                <p class='text-sm font-mono text-muted-foreground'>
                    WEB INTERFACE
                </p>
            </header>
			<div class="flex flex-col gap-1">
				{@render nav_content()}
			</div>
		</Sheet.Content>
	</Sheet.Root>

    <header class="flex flex-row items-center gap-4 mr-4">
        <h1>
            ORION
        </h1>
        <p class='text-sm font-mono text-muted-foreground'>
            WEB INTERFACE
        </p>
    </header>
</div>
