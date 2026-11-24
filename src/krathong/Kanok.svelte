<script lang="ts">
	/** A thin row of kranok/krajang (กระจัง) tips — the pointed flame-leaf of Thai lai patterns. */
	let { tone = 'var(--marigold)' }: { tone?: string } = $props();
</script>

<svg class="kanok" viewBox="0 0 240 12" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style:color={tone}>
	<defs>
		<pattern id="kj" width="16" height="12" patternUnits="userSpaceOnUse">
			<path d="M8 1 C10.5 4.5 12.5 7 12 9.5 C11.4 11.3 9.4 11.6 8 10.2 C6.6 11.6 4.6 11.3 4 9.5 C3.5 7 5.5 4.5 8 1 Z" fill="none" stroke="currentColor" stroke-width="0.9" />
			<path d="M8 5.2 C8.9 6.6 9.4 7.8 8 9 C6.6 7.8 7.1 6.6 8 5.2 Z" fill="currentColor" />
			<path d="M0 11.5 H16" stroke="currentColor" stroke-width="0.6" />
		</pattern>
	</defs>
	<rect width="240" height="12" fill="url(#kj)" />
</svg>

<style>
	.kanok {
		display: block;
		width: 100%;
		height: 12px;
		opacity: 0.55;
	}
</style>
