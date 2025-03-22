<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	let { children } = $props();

    onMount(() => {
        const targetDiv = document.querySelector('.maplibregl-ctrl-bottom-right');

        if (targetDiv) {
            targetDiv.remove();
        }
    })
</script>

<div class="flex h-screen w-screen dark items-center justify-center overflow-hidden bg-neutral-950">
	{@render children?.()}
</div>
