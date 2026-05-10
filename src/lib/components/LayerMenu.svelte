<script>
  import { createEventDispatcher, tick } from 'svelte';

  /** @type {string} 'Yields' | 'Upkeep' | 'Workforce Demand' */
  export let label;
  /** @type {string} 'yield' | 'upkeep' | 'workforce' */
  export let category;
  /** @type {{key: string, label: string}[]} */
  export let options;
  /** @type {string | null} The active sub-key, or null if this dropdown is not the active tab. */
  export let activeKey = null;
  /** @type {string} Fallback when activeKey is null and the user clicks the trigger. */
  export let defaultKey;

  const dispatch = createEventDispatcher();

  let open = false;
  let lastUsedSub = activeKey ?? defaultKey;
  let triggerEl;
  let popupEl;

  $: if (activeKey) lastUsedSub = activeKey;
  $: if (!activeKey && !options.some((opt) => opt.key === lastUsedSub)) {
    lastUsedSub = options.some((opt) => opt.key === defaultKey)
      ? defaultKey
      : options[0]?.key ?? defaultKey;
  }

  $: activeOption = activeKey ? options.find((o) => o.key === activeKey) : null;
  $: triggerLabel = activeOption ? `${label} · ${activeOption.label}` : label;

  function onTriggerClick() {
    if (activeKey) {
      // Already the active tab — open the popup so the user can switch sub.
      open = !open;
    } else {
      // Not active — first click selects lastUsedSub without opening the popup.
      if (!lastUsedSub) return;
      dispatch('select', { layerId: `${category}:${lastUsedSub}` });
    }
  }

  function onItemClick(key) {
    open = false;
    dispatch('select', { layerId: `${category}:${key}` });
  }

  function onPopupKeydown(e) {
    if (e.key === 'Escape') {
      open = false;
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = Array.from(popupEl.querySelectorAll('[role=menuitem]'));
      const idx = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      const focused = document.activeElement;
      const key = focused?.dataset?.key;
      if (key) {
        e.preventDefault();
        onItemClick(key);
      }
    }
  }

  async function handleOpenChange(value) {
    if (value) {
      await tick();
      const first = popupEl?.querySelector('[role=menuitem]');
      first?.focus();
    } else {
      triggerEl?.focus();
    }
  }
  $: handleOpenChange(open);

  function onOutsideClick(e) {
    if (!open) return;
    if (!popupEl?.contains(e.target) && !triggerEl?.contains(e.target)) {
      open = false;
    }
  }
</script>

<svelte:window on:click={onOutsideClick} />

<span class="layer-menu">
  <button
    bind:this={triggerEl}
    type="button"
    class="layer-menu-trigger"
    aria-pressed={!!activeKey}
    aria-haspopup="menu"
    aria-expanded={open}
    on:click={onTriggerClick}
  >
    {triggerLabel}
    <span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div
      bind:this={popupEl}
      class="layer-menu-popup"
      role="menu"
      tabindex="-1"
      on:keydown={onPopupKeydown}
    >
      {#each options as opt}
        <button
          type="button"
          role="menuitem"
          class="layer-menu-item"
          class:active={opt.key === activeKey}
          data-key={opt.key}
          on:click={() => onItemClick(opt.key)}
        >
          <span class="dot" aria-hidden="true"></span>
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</span>

<style>
  .layer-menu { position: relative; display: inline-block; }
</style>
