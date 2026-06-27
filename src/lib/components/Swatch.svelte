<script>
  // Solid colour chip — resource swatches, legend keys, party markers.
  export let color = 'var(--accent)';
  export let width = '100%';
  export let height = '12px';
</script>

<span class="swatch" style="width:{width}; height:{height}; background:{color}" aria-hidden="true"></span>

<style>
  .swatch {
    display: block;
    flex: 0 0 auto;
  }
</style>
