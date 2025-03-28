<script lang="ts">
	import DrawingOverlay from '$lib/components/DrawingOverlay.svelte';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Undo from '@lucide/svelte/icons/undo';
	import Redo from '@lucide/svelte/icons/redo';

	let drawing = $state(false);
	let color = $state('#ffffff');

	let overlayRef: HTMLCanvasElement = $state();

	function toggleDrawing() {
		drawing = !drawing;
	}

	function undoCanvas() {
		overlayRef?.undo();
	}

	function redoCanvas() {
		overlayRef?.redo();
	}
</script>

{#if drawing}
	<DrawingOverlay {color} bind:this={overlayRef} />
{/if}

<div
	class="invisible absolute bottom-2 left-2 z-40 mb-[6.5rem] flex w-[97%] flex-shrink-0 flex-row items-center justify-start gap-1.5 rounded-md md:visible lg:bottom-10 lg:left-auto lg:w-[35rem]"
>
	<button
		onclick={toggleDrawing}
		class="flex h-10 w-10 items-center justify-center border duration-100 hover:bg-neutral-800
		{drawing
			? 'bg-white text-black hover:bg-neutral-400 hover:text-black/70'
			: 'bg-background hover:bg-neutral-800'}"
	>
		<PencilLine size={20} />
	</button>

	<button
		class="flex h-10 w-10 items-center justify-center border bg-background duration-100 hover:bg-neutral-800"
		onclick={undoCanvas}
	>
		<Undo size={20} />
	</button>

	<button
		class="flex h-10 w-10 items-center justify-center border bg-background duration-100 hover:bg-neutral-800"
		onclick={redoCanvas}
	>
		<Redo size={20} />
	</button>

	<!-- Custom Color Picker Button -->
	<div class="relative h-10 w-10 border">
		<div class="h-full w-full cursor-pointer" style={`background-color: ${color};`}></div>
		<input
			type="color"
			bind:value={color}
			class="absolute left-0 top-0 h-full w-full cursor-pointer opacity-0"
			oninput={(e) => {
				if (overlayRef) overlayRef.color = (e.target as HTMLInputElement).value;
			}}
		/>
	</div>
</div>
