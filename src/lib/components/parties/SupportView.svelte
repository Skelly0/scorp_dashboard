<script>
  // Parties "Support" tab: the class × party support heatmap (Supporters / % of
  // Class tabs, Supporters authoritative per gotcha #44) + the party × GoI
  // compatibility heatmap. Compatibility stays a separate band because its axes
  // differ (party × GoI, not class × party).
  import Band from '../Band.svelte';
  import Heatmap from '../Heatmap.svelte';

  /** @type {{classes, parties, values} | null} */ export let pctMatrix = null;
  /** @type {{classes, parties, values} | null} */ export let popMatrix = null;
  /** @type {{classes, parties, values} | null} */ export let fallbackPopMatrix = null;
  /** @type {{parties, gois, values} | null} */ export let goiMatrix = null;

  $: hasPct = pctMatrix?.values?.length > 0;
  $: hasPop = popMatrix?.values?.length > 0;
  $: hasFallbackPop = !hasPop && fallbackPopMatrix?.values?.length > 0;
  $: hasGoi = goiMatrix?.values?.length > 0;

  let supportTab = 'pop'; // 'pop' | 'pct' — Supporters is authoritative
  $: if (supportTab === 'pop' && !hasPop && !hasFallbackPop && hasPct) supportTab = 'pct';
</script>

{#if hasPct || hasPop || hasFallbackPop}
  <Band num="01" title="Class × Party Support" meta={supportTab === 'pct' ? '% of class' : 'people'} />
  <div class="s-card">
    <div class="layer-tabs" role="group" aria-label="Class × party view">
      {#if hasPop || hasFallbackPop}
        <button aria-pressed={supportTab === 'pop'} on:click={() => (supportTab = 'pop')}>Supporters</button>
      {/if}
      {#if hasPct}
        <button aria-pressed={supportTab === 'pct'} on:click={() => (supportTab = 'pct')}>% of Class</button>
      {/if}
    </div>
    <div class="s-card-pad">
      {#if supportTab === 'pct' && hasPct}
        <Heatmap
          rowLabels={pctMatrix.classes}
          colLabels={pctMatrix.parties}
          values={pctMatrix.values}
          format="pctSign"
          rowHeadWidth={180}
          minCellWidth={72}
        />
      {:else if supportTab === 'pop' && hasPop}
        <Heatmap
          rowLabels={popMatrix.classes}
          colLabels={popMatrix.parties}
          values={popMatrix.values}
          format="int"
          rowHeadWidth={180}
          minCellWidth={72}
        />
      {:else if supportTab === 'pop' && hasFallbackPop}
        <Heatmap
          rowLabels={fallbackPopMatrix.classes}
          colLabels={fallbackPopMatrix.parties}
          values={fallbackPopMatrix.values}
          format="int"
          rowHeadWidth={180}
          minCellWidth={72}
        />
      {/if}
    </div>
  </div>
{/if}

{#if hasGoi}
  <Band num="02" title="Interest-Group Compatibility" meta="Party × GoI affinity" />
  <div class="s-card s-card-pad">
    <Heatmap
      rowLabels={goiMatrix.parties}
      colLabels={goiMatrix.gois}
      values={goiMatrix.values}
      rowHeadWidth={180}
      minCellWidth={64}
    />
  </div>
{/if}

{#if !hasPct && !hasPop && !hasFallbackPop && !hasGoi}
  <Band num="01" title="Class × Party Support" />
  <div class="s-card s-card-pad">
    <p class="text-muted text-sm">No support-capture data available yet.</p>
  </div>
{/if}
