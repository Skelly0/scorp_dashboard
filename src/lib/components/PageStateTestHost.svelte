<script>
  import PageState from './PageState.svelte';
  export let label;
  export let page;
  export let error = null;
  export let loading = false;
  export let loadingText = 'Loading…';
  export let retry = null;
</script>

<PageState {label} {page} {error} {loading} {loadingText} {retry}>
  <p data-testid="page-content">content</p>
</PageState>
