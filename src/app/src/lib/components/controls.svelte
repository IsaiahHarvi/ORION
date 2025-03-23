<script lang="ts">
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import { Slider } from '$lib/components/ui/slider';
    import Search from '@lucide/svelte/icons/search';
    import { cursor_data } from '$lib/runes/cursor.svelte';
	import { flyAndScale } from '$lib/utils';

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
</script>

<div transition:flyAndScale class="absolute hidden md:visible bottom-10 right-10">
	<div class="flex flex-row items-end gap-2">
        <div class="bg-background border rounded-lg  p-2 px-2">
            <p class="font-mono text-sm">
                Cursor: {cursor_data.lat.toFixed(3)}, {cursor_data.lng.toFixed(3)}
            </p>
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
