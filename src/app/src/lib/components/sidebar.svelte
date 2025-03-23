<script lang="ts">
    import { Button, buttonVariants } from '$lib/components/ui/button'
    import { page } from '$app/stores';
	import type { Snippet } from 'svelte';
    import * as Sheet from "$lib/components/ui/sheet";
    import Globe from '@lucide/svelte/icons/globe'
    import Menu from '@lucide/svelte/icons/menu'

    let { children }: {
        children?: Snippet
    } = $props();

    const tabs = [
        {
            name: 'RADAR',
            href: '/',
        },
        {
            name: 'UAV',
            href: '/uav'
        },
        {
            name: 'AIS',
            href: '/ais'
        }
    ];

    let open = $state(false);
</script>

{#snippet sidebarContent()}
    <h1 class='text-foreground flex flex-row items-center gap-2 text-lg pt-4 font-medium'>
        <Globe size={20} />
        ORION
    </h1>

    <div class="mt-4 flex flex-col gap-1">
        {#each tabs as tab}
            <Button onclick={() => {
                open = false;
            }} href={tab.href} variant={$page.url.pathname === tab.href ? 'secondary' : 'ghost'} class="{$page.url.pathname === tab.href ? 'font-semibold' : ''} text-foreground w-full text-left items-start justify-start">
                {tab.name}
            </Button>
        {/each}
    </div>
{/snippet}
 
<div class="bg-neutral-900 flex-shrink-0 border-r invisible lg:visible lg:w-64 xl:w-[20rem] px-4 h-screen flex flex-col">
    {@render sidebarContent()}
</div>

<div class="bg-neutral-900 border-b px-4 gap-4 z-40 absolute flex items-center flex-row h-16 top-0 left-0 w-screen visible md:invisible">
    <Sheet.Root bind:open>
        <Sheet.Trigger class={buttonVariants({ variant: "outline", size: 'icon' })}>
            <Menu size={16} />
        </Sheet.Trigger>
        <Sheet.Content side="left">
            {@render sidebarContent()}
        </Sheet.Content>
    </Sheet.Root>
    <h1 class='text-foreground flex flex-row items-center gap-2 text-lg font-medium'>
        <Globe size={20} />
        ORION
    </h1>
</div>