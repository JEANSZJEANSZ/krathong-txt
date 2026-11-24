<script lang="ts">
	import KrathongPage from './krathong/KrathongPage.svelte';
	import { parseAppRoute } from './krathong/share';

	// One shared river: drop any legacy ?room= from the address bar.
	if (location.search) history.replaceState(null, '', location.pathname + location.hash);

	let route = $state(parseAppRoute(location.hash));
	function onHash() {
		route = parseAppRoute(location.hash);
	}
</script>

<svelte:window onhashchange={onHash} />

{#key route.token}
	<KrathongPage token={route.token} />
{/key}
