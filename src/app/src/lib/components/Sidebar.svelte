<script lang="ts">
	import { page } from '$app/state';
	import Radar from '@lucide/svelte/icons/radar';
	import Globe from '@lucide/svelte/icons/globe';
	import Menu from '@lucide/svelte/icons/menu';
	import * as Sheet from "$lib/components/ui/sheet";
	import { Button, buttonVariants } from '$lib/components/ui/button';
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { map_style_urls } from '$lib/map-styles';
    import { map_style_state } from '$lib/runes/map-style.svelte';
	import { map_state } from '$lib/runes/map-state.svelte';
    import { layers_state } from '$lib/runes/toggleable-layers.svelte';
	import { toast } from 'svelte-sonner';

	import UAV from '$lib/icons/uav-icon.png';
	import Ship from '$lib/icons/ship-icon.png';

	const tabs = [
		{ name: 'Radar', href: '/', icon: Radar },
		{ name: 'UAV', href: '/uav', icon: UAV },
		{ name: 'AIS', href: '/ais', icon: Ship }
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
		class="px-3 p-2 w-full placeholder:text-neutral-500 text-sm font-mono bg-neutral-800 border border-neutral-700 rounded-md mb-2 mt-1"
	/>
    <div class="lg:hidden flex flex-col items-start gap-4 py-4 w-full">
        <div class="flex items-center justify-center flex-row gap-3 w-full">
            <Checkbox bind:checked={radarLayersChecked} id="radar-layers" />
            <label class="text-sm text-white font-mono w-full" for="radar-layers">
                Show Weather Radar
            </label>
        </div>
        <div class="flex items-center justify-center flex-row gap-3 w-full">
            <Checkbox bind:checked={radarStationsChecked} id="radar-stations" />
            <label class="text-sm text-white font-mono w-full" for="radar-stations">
                Show Radar Stations
            </label>
        </div>
    </div>
	<p class="text-sm py-3 font-mono text-muted-foreground">
		LAYERS
	</p>
	{#each tabs as tab}
		<a
			href={tab.href}
			class='w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors
			{page.url.pathname === tab.href ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}'
			onclick={() => (open = false)}
		>
			{#if typeof tab.icon === 'string'}
				<img src={tab.icon} alt={tab.name} class="w-5 h-5" />
			{:else}
				<tab.icon size={20} />
			{/if}
			<span>{tab.name}</span>
		</a>
	{/each}
	<p class="text-sm py-3 font-mono text-muted-foreground">
		MAP STYLES
	</p>
	{#each map_style_urls.slice().sort((a, b) => a.localeCompare(b)) as style}
		<button
			class='w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm transition-colors
			{map_style_state.data === style ? 'bg-neutral-800 text-white font-semibold' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}'
			onclick={() => {
				open = false;
				map_style_state.data = style;
			}}
		>
			<span>{style.charAt(0).toUpperCase() + style.slice(1)}</span>
		</button>
	{/each}
{/snippet}

<div class="bg-neutral-900 flex-shrink-0 border-r pt-6 invisible lg:visible lg:w-64 xl:w-[20rem] px-4 h-screen flex flex-col">
	<div class="flex items-center gap-2 text-lg font-medium text-foreground mb-4">
		<Globe size={20} />
		ORION
	</div>

	<div class="flex flex-col gap-1">
        {@render nav_content()}
	</div>
</div>

<div class="bg-neutral-900 border-b px-4 gap-4 z-40 fixed flex items-center h-14 top-0 left-0 w-screen lg:hidden">
	<Sheet.Root bind:open>
		<Sheet.Trigger class={buttonVariants({ variant: "ghost", size: 'icon' })}>
			<Menu size={16} />
		</Sheet.Trigger>
		<Sheet.Content side="left" class="w-[75%] px-4 py-6">
			<div class="flex items-center gap-2 text-lg font-medium text-foreground mb-6">
				<Globe size={20} />
				ORION
			</div>
			<div class="flex flex-col gap-1">
                {@render nav_content()}
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<h1 class="text-foreground flex flex-row items-center gap-2 text-lg font-medium">
		<Globe size={20} />
		ORION
	</h1>
</div>
