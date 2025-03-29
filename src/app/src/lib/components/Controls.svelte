<script lang="ts">
	import { cursor_data } from '$lib/runes/cursor.svelte';
	import { flyAndScale } from '$lib/utils';
</script>

<div
	transition:flyAndScale
	class="z-[90] absolute bottom-0 w-screen lg:block hidden lg:ml-64 xl:ml-[20rem]"
>
	<p class="text-sm border-t h-10 px-4 bg-background text-muted-foreground gap-6 flex flex-row items-center justify-start">
        <span>LAT: {Math.abs(cursor_data.lat).toFixed(3)}° {cursor_data.lat >= 0 ? 'N' : 'S'}</span>
        <span>LON: {Math.abs(cursor_data.lng).toFixed(3)}° {cursor_data.lng >= 0 ? 'E' : 'W'}</span>
    </p>
</div>
