<script lang="ts">
	import { onMount } from 'svelte';

	let canvas: HTMLCanvasElement | null = null;
	let ctx: CanvasRenderingContext2D;
	let isDrawing = false;
	let isPenActive = false;
	let color = '#ffffff';

	function getPos(e: MouseEvent | TouchEvent) {
		const rect = canvas!.getBoundingClientRect();
		if (e instanceof TouchEvent) {
			const touch = e.touches[0] || e.changedTouches[0];
			return {
				x: touch.clientX - rect.left,
				y: touch.clientY - rect.top
			};
		} else {
			return {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top
			};
		}
	}

	function startDraw(e: MouseEvent | TouchEvent) {
		if (!canvas || !ctx || !isPenActive) return;
		isDrawing = true;
		const { x, y } = getPos(e);
		ctx.beginPath();
		ctx.moveTo(x, y);
	}

	function draw(e: MouseEvent | TouchEvent) {
		if (!isDrawing || !ctx || !canvas) return;

		e.preventDefault(); // prevent scrolling while drawing
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
		}
	}

	onMount(() => {
		if (!canvas) return;
		ctx = canvas.getContext('2d')!;
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		window.addEventListener('resize', () => {
			if (canvas) {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			}
		});
	});
</script>

<style>
	canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: black;
		z-index: 0;
		touch-action: none; /* disables pinch zoom so you can draw */
	}

	.controls {
		position: fixed;
		top: 1rem;
		left: 1rem;
		z-index: 10;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}

	button, input[type="color"] {
		padding: 0.4rem 0.8rem;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 1rem;
	}
</style>

<!-- Controls -->
<div class="controls">
	<button on:click={() => isPenActive = !isPenActive} style="background-color: #007bff; color: white;">
		{isPenActive ? 'Disable Pen' : 'Enable Pen'}
	</button>

	<button on:click={clearCanvas} style="background-color: red; color: white;">
		Clear
	</button>

	<input type="color" bind:value={color} title="Choose pen color" />
</div>

<!-- Drawing Canvas (supports touch & mouse) -->
<canvas
	bind:this={canvas}
	on:mousedown={startDraw}
	on:mousemove={draw}
	on:mouseup={stopDraw}
	on:mouseleave={stopDraw}
	on:touchstart={startDraw}
	on:touchmove={draw}
	on:touchend={stopDraw}
/>
