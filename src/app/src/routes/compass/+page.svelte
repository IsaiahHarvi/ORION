<script lang="ts">
	import { onMount } from 'svelte';

	let heading = 0;
	let map: any; // <-- This should point to your MapLibre instance
	let mapElement: HTMLElement;

	onMount(() => {
		// Make sure map exists
		map = new maplibregl.Map({
			container: mapElement,
			style: 'https://api.maptiler.com/maps/0195bee2-9b1b-7b54-b0c9-fb330ebe7162/style.json?key=rIQyeDoL1FNvjM5uLY2f',
			center: [-98.5795, 39.8283],
			zoom: 8,
			bearing: 0 // North facing up
		});

		// Set initial heading
		map.on('load', () => {
			heading = -map.getBearing();

			// Update heading on rotation
			map.on('rotate', () => {
				heading = -map.getBearing();
			});
		});
	});
</script>

<!-- Map container -->
<div class="absolute inset-0" bind:this={mapElement}></div>

<!-- Compass overlay -->
<div id="compass-container">
	<div id="compass-rose">
		<div
			class="needle"
			style="transform: rotate({heading}deg);"
		/>
		<div class="label n">N</div>
		<div class="label s">S</div>
		<div class="label e">E</div>
		<div class="label w">W</div>
	</div>
</div>

<style>
	#compass-container {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		width: 90px;
		height: 90px;
		border-radius: 50%;
		background: radial-gradient(circle, #1a1a1a 70%, #2a2a2a 100%);
		border: 1px solid #444;
		box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
		z-index: 1000;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	#compass-rose {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.needle {
		position: absolute;
		width: 0;
		height: 0;
		border-left: 6px solid transparent;
		border-right: 6px solid transparent;
		border-bottom: 30px solid #8b0000;
		transform-origin: bottom center;
		transition: transform 0.2s ease;
		z-index: 2;
	}

	.label {
		position: absolute;
		color: #ccc;
		font-size: 11px;
		font-weight: 600;
		user-select: none;
		opacity: 0.8;
	}

	.label.n { top: 6px; left: 50%; transform: translateX(-50%); }
	.label.s { bottom: 6px; left: 50%; transform: translateX(-50%); }
	.label.e { right: 6px; top: 50%; transform: translateY(-50%); }
	.label.w { left: 6px; top: 50%; transform: translateY(-50%); }
</style>
