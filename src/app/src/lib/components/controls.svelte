<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import { Slider } from '$lib/components/ui/slider';

	const { map } = $props();

	let zoom_increments = 0.5;
    let old_zoom_value = $state(0);
	let zoom_value = $state(3);
	let sliderChanging = false;

	function zoomIn() {
		map.zoomIn(zoom_increments);
	}

	function zoomOut() {
		map.zoomOut(zoom_increments);
	}

	onMount(() => {
		if (map) {
			zoom_value = map.getZoom();
			map.on('zoom', () => {
				if (!sliderChanging) {
					zoom_value = map.getZoom();
				}
			});
		}
	});

	$effect(() => {
        if(old_zoom_value !== zoom_value) {
            old_zoom_value = zoom_value
            map.setZoom(zoom_value)
        }
    })
</script>

<div class="absolute bottom-10 right-10">
	<div>
		<div class="bg-background py-2 border rounded-lg">
			<Slider
				type="single"
				orientation="vertical"
				class="w-full mx-2 mt-2"
				min={3}
				max={24}
				step={0.25}
				size={4}
				bind:value={zoom_value} />
		</div>
		<div class="bg-background border rounded-lg mt-2 flex flex-col">
			<button class="h-8 w-8 flex items-center justify-center" onclick={zoomIn}>
				<Plus size="20" />
			</button>
			<button class="h-8 w-8 flex items-center justify-center" onclick={zoomOut}>
				<Minus size="20" />
			</button>
		</div>
	</div>
</div>
