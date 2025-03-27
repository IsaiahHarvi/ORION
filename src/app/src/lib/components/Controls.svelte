<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import { cursor_data } from '$lib/runes/cursor.svelte';
	import { flyAndScale } from '$lib/utils';

	const { map } = $props();

	let zoom_increments = 0.5;

	function zoomIn() {
		map.zoomIn(zoom_increments);
	}

	function zoomOut() {
		map.zoomOut(zoom_increments);
	}
</script>

<div
	transition:flyAndScale
	class="invisible absolute right-2 top-16 z-[90] md:visible xl:bottom-10 xl:right-10 xl:top-auto"
>
	<div class="flex flex-row items-start gap-2 xl:items-end">
		<div class="mt-2 rounded-lg border bg-background p-2 px-2 xl:mt-0">
			<p class="font-mono text-sm">
				Cursor: {cursor_data.lat.toFixed(3)}, {cursor_data.lng.toFixed(3)}
			</p>
		</div>
		<div class="mt-2 flex flex-col rounded-lg border bg-background">
			<button class="flex h-8 w-8 items-center justify-center" onclick={zoomIn}>
				<Plus size="20" />
			</button>
			<button class="flex h-8 w-8 items-center justify-center" onclick={zoomOut}>
				<Minus size="20" />
			</button>
		</div>
	</div>
</div>
