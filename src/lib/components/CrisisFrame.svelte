<script>
  import { crisisBreach } from '../stores/crisis.js';
</script>

{#if $crisisBreach.breached}
  <div class="crisis-frame" aria-hidden="true" style="--crisis-intensity:{$crisisBreach.intensity}">
    <div class="crisis-vignette"></div>
    <div class="crisis-scan"></div>
    <div class="crisis-edge top"></div>
    <div class="crisis-edge right"></div>
    <div class="crisis-edge bottom"></div>
    <div class="crisis-edge left"></div>
  </div>
{/if}
