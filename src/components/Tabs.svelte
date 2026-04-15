<script lang="ts">
  export type TabId = 'transacoes' | 'pessoas' | 'padroes' | 'upload'

  interface Tab {
    id: TabId
    label: string
  }

  interface Props {
    active: TabId
    onchange: (tab: TabId) => void
  }

  const { active, onchange }: Props = $props()

  const tabs: Tab[] = [
    { id: 'transacoes', label: 'Transacoes' },
    { id: 'pessoas',    label: 'Pessoas'    },
    { id: 'padroes',    label: 'Padroes'    },
    { id: 'upload',     label: '+ Adicionar CSV' },
  ]
</script>

<div class="tabs">
  {#each tabs as tab (tab.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tab"
      class:active={active === tab.id}
      onclick={() => onchange(tab.id)}
    >
      {tab.label}
    </div>
  {/each}
</div>
