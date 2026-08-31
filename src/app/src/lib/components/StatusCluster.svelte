<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge } from '@sivir-ui/svelte';

	let { online }: { online: boolean } = $props();
	let now = $state(Date.now());

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		const weekday = date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
		const day = date.getDate().toString().padStart(2, '0');
		const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
		const year = date.getFullYear().toString().slice(-2);
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${weekday} ${day} ${month} ${year}, ${hours}:${minutes}`;
	}

	onMount(() => {
		const interval = window.setInterval(() => (now = Date.now()), 60_000);
		return () => window.clearInterval(interval);
	});
</script>

<div
	class="orion-surface absolute top-[18px] right-5 z-40 hidden items-center gap-2 rounded-[var(--radius-xl)] px-2 py-1.5 lg:flex"
>
	<Badge variant={online ? 'success' : 'error'} dot>{online ? 'Online' : 'Offline'}</Badge>
	<time
		class="text-foreground-muted font-mono text-xs tabular-nums"
		datetime={new Date(now).toISOString()}
	>
		{formatTimestamp(now)}
	</time>
</div>
