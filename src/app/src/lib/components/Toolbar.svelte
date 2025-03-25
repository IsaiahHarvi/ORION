<script lang="ts">
	import DrawingOverlay from '$lib/components/DrawingOverlay.svelte';
	import Trash from '@lucide/svelte/icons/trash';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Undo from '@lucide/svelte/icons/undo';
	import Redo from '@lucide/svelte/icons/redo';

	let drawing = $state(false);
	let color = $state('#ffffff');

	let overlayRef: any;

	function toggleDrawing() {
		drawing = !drawing;
	}

	function clearCanvas() {
		overlayRef?.clearCanvas();
	}

	function undoCanvas() {
		overlayRef?.undo();
	}

	function redoCanvas() { 
		overlayRef?.redo();
	}
</script>

{#if drawing}
	<DrawingOverlay color={color} bind:this={overlayRef} />
{/if}

<div class="absolute invisible md:visible bottom-2 mb-[6.5rem] left-2 lg:left-auto lg:bottom-10 w-[97%] items-center justify-start rounded-md z-40 lg:w-[35rem] flex-shrink-0 flex flex-row gap-1.5">
	<button onclick={toggleDrawing}
		class="w-10 h-10 flex items-center justify-center border hover:bg-neutral-800 duration-100
		{drawing ? 'text-black bg-white hover:text-black/70 hover:bg-neutral-400' : 'bg-neutral-900 hover:bg-neutral-800'}">
		<PencilLine size={20} />
	</button>

	<button class="w-10 h-10 flex items-center justify-center border bg-neutral-900 hover:bg-neutral-800 duration-100" onclick={undoCanvas}>
		<Undo size={20} />
	</button>

	<button class="w-10 h-10 flex items-center justify-center border bg-neutral-900 hover:bg-neutral-800 duration-100" onclick={redoCanvas}>
		<Redo size={20} />
	</button>

	<!-- Custom Color Picker Button -->
	<div class="relative w-10 h-10 border">
		<div
			class="w-full h-full cursor-pointer"
			style={`background-color: ${color};`}
		></div>
		<input
			type="color"
			bind:value={color}
			class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
			oninput={(e) => {
				if (overlayRef) overlayRef.color = e.target.value;
			}}
		/>
	</div>
</div>
