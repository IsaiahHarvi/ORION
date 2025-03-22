<script lang="ts">
    import { Button } from '$lib/components/ui/button'
    import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
    import Globe from '@lucide/svelte/icons/globe'

    let { children }: {
        children?: Snippet
    } = $props();

    const tabs = [
        {
            name: 'Radar',
            href: '/',
        },
        {
            name: 'UAV',
            href: '/uav'
        }
    ];
</script>
 
<div class="bg-neutral-900 flex-shrink-0 border-r w-80 px-4 h-screen flex flex-col">
    <h1 class='text-foreground flex flex-row items-center gap-2 text-lg pt-4 font-medium'>
        <Globe size={20} />
        ORION
    </h1>

    <div class="mt-4 flex flex-col gap-1">
        {#each tabs as tab}
            <Button href={tab.href} variant={$page.url.pathname === tab.href ? 'secondary' : 'ghost'} class="{$page.url.pathname === tab.href ? 'font-semibold' : ''} text-foreground w-full text-left items-start justify-start">
                {tab.name}
            </Button>
        {/each}
    </div>
</div>