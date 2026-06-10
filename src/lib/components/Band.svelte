<script>
  export let num = '';
  export let title;
  export let meta = '';
</script>

<div class="band">
  {#if num}<span class="band-num">{num}</span>{/if}
  <h2 class="band-title">{title}</h2>
  <span class="band-rule"></span>
  {#if meta}<span class="band-meta">{meta}</span>{/if}
</div>
