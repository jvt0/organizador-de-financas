<script lang="ts">
  export type TabId = 'transacoes' | 'pessoas' | 'padroes' | 'upload'

  interface Tab { id: TabId; label: string }

  interface Props {
    active: TabId
    onchange: (tab: TabId) => void
  }

  const { active, onchange }: Props = $props()

  const tabs: Tab[] = [
    { id: 'transacoes', label: 'Transacoes'      },
    { id: 'pessoas',    label: 'Pessoas'          },
    { id: 'padroes',    label: 'Padroes'          },
    { id: 'upload',     label: '+ Adicionar CSV'  },
  ]
</script>

<nav class="tabs">
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      class="tab"
      class:active={active === tab.id}
      onclick={() => onchange(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  .tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }

  .tab {
    /* reset button */
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    /* visual */
    padding: 10px 20px;
    margin-bottom: -1px;
    cursor: pointer;
    color: var(--muted);
    font-size: 13px;
    font-family: 'IBM Plex Mono', monospace;
    transition: all .15s;
  }
  .tab:hover  { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
</style>
