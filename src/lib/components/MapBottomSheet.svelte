<script>
  import { onDestroy, onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let dialogEl;
  let closeButtonEl;
  let previousActiveElement = null;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function dismiss() {
    dispatch('dismiss');
  }

  function getFocusableElements() {
    if (!dialogEl) return [];
    return Array.from(dialogEl.querySelectorAll(focusableSelector))
      .filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
  }

  function focusInitialElement() {
    const target = closeButtonEl ?? dialogEl;
    target?.focus?.();
  }

  function handleEscape(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    dismiss();
  }

  function handleDialogKeydown(e) {
    if (e.key === 'Escape') {
      handleEscape(e);
      return;
    }
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      e.preventDefault();
      dialogEl?.focus?.();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!dialogEl?.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
      return;
    }

    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onMount(async () => {
    previousActiveElement = document.activeElement;
    await tick();
    focusInitialElement();
  });

  onDestroy(() => {
    if (
      previousActiveElement?.isConnected &&
      typeof previousActiveElement.focus === 'function'
    ) {
      previousActiveElement.focus();
    }
  });
</script>

<svelte:window on:keydown|capture={handleEscape} />

<div class="s-sheet-backdrop md:hidden" role="presentation" on:click={dismiss}></div>
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<section
  bind:this={dialogEl}
  class="s-sheet map-inspector-sheet md:hidden"
  role="dialog"
  aria-modal="true"
  aria-label="Tile inspector"
  tabindex="-1"
  on:keydown={handleDialogKeydown}
>
  <button
    bind:this={closeButtonEl}
    class="s-rail-close map-sheet-close"
    type="button"
    aria-label="Close tile inspector"
    on:click={dismiss}
  >x</button>
  <slot />
</section>
