<script lang="ts">
	import { spriteRows, type SpriteSpec } from './sprite';
	let { spec, width = 13 }: { spec: SpriteSpec; width?: number } = $props();
	const rows = $derived(spriteRows(spec, width));
</script>

<pre class="ascii" aria-hidden="true">{#each rows as row, r (r)}{#each row as cell, i (i)}<span style:color={cell.color}>{cell.ch}</span>{/each}{'\n'}{/each}</pre>

<style>
	.ascii {
		margin: 0;
		font-family: var(--mono);
		font-size: var(--ap-size, 0.62rem);
		line-height: 1.02;
		letter-spacing: 0;
		white-space: pre;
		text-shadow: 0 0 6px rgba(255, 220, 160, 0.15);
	}
</style>
