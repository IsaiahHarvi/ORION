<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="flex dark h-screen w-screen items-center justify-center overflow-hidden bg-black">
	{@render children?.()}
</div>
