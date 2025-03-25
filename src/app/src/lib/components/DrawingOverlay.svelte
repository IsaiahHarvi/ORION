<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { map_state } from '$lib/runes/map-state.svelte';

	let { color = '#ffffff' } = $props();

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D | null = null;
	let isDrawing = false;
	let isPenActive = true;

	let history: ImageData[] = [];
	let redoStack: ImageData[] = [];

	function getPos(e: MouseEvent | TouchEvent) {
		const rect = canvas!.getBoundingClientRect();
		if (e instanceof TouchEvent) {
			const touch = e.touches[0] || e.changedTouches[0];
			return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
		} else {
			return { x: e.clientX - rect.left, y: e.clientY - rect.top };
		}
	}

	function startDraw(e: MouseEvent | TouchEvent) {
		if (!canvas || !ctx || !isPenActive) return;
		isDrawing = true;

		history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
		redoStack = [];

		const { x, y } = getPos(e);
		ctx.beginPath();
		ctx.moveTo(x, y);
	}

	function draw(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !ctx || !canvas) return;
		e.preventDefault();
		const { x, y } = getPos(e);

		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		ctx.strokeStyle = color;

		ctx.lineTo(x, y);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x, y);
	}

	function stopDraw() {
		isDrawing = false;
		ctx?.beginPath();
	}

	function clearCanvas() {
		if (ctx && canvas) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			history = [];
			redoStack = [];
		}
	}

	function undo() {
		if (!ctx || !canvas || history.length === 0) return;
		const last = history.pop();
		redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
		if (last) ctx.putImageData(last, 0, 0);
	}

	function redo() {
		if (!ctx || !canvas || redoStack.length === 0) return;
		const redoImg = redoStack.pop();
		history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
		if (redoImg) ctx.putImageData(redoImg, 0, 0);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		} else if (e.ctrlKey && e.key.toLowerCase() === 'z' && e.shiftKey) {
			e.preventDefault();
			redo();
		}
	}

	onMount(() => {
		if (!canvas) return;
		ctx = canvas.getContext('2d');
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		window.addEventListener('resize', () => {
			if (canvas) {
				const img = ctx?.getImageData(0, 0, canvas.width, canvas.height);
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
				if (img && ctx) ctx.putImageData(img, 0, 0);
			}
		});

		window.addEventListener('keydown', handleKeydown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		canvas?.style.setProperty('pointer-events', isPenActive ? 'auto' : 'none');
	});

	export { clearCanvas, undo, redo };
</script>

<canvas
	bind:this={canvas}
	class="absolute top-0 left-0 w-screen h-screen z-[35] touch-none"
	onmousedown={startDraw}
	onmousemove={draw}
	onmouseup={stopDraw}
	onmouseleave={stopDraw}
	ontouchstart={startDraw}
	ontouchmove={draw}
	ontouchend={stopDraw}
	style="background: transparent;"
></canvas>

<style>
	canvas {
		touch-action: none;
	}
</style>
