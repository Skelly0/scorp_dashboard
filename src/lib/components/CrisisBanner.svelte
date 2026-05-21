<script>
  import { crisisBreach } from '../stores/crisis.js';
</script>

{#if $crisisBreach.breached}
  <div class="crisis-banner" role="status">
    <div class="hz t" aria-hidden="true"></div>
    <div class="crisis-banner-mid">
      <span class="sig" aria-hidden="true">⚠</span>
      <span class="htxt">Crisis Threshold Breached</span>
      <span class="hsub">Load {$crisisBreach.factor.toFixed(2)} · capacity exceeded</span>
    </div>
    <div class="hz b" aria-hidden="true"></div>
  </div>
{/if}
