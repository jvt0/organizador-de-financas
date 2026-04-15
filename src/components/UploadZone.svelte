<script lang="ts">
  interface ArquivoCarregado {
    id: string
    nome: string
    meta: string
    status: 'ok' | 'warn' | 'err'
  }

  interface Props {
    arquivos: ArquivoCarregado[]
    onremove: (id: string) => void
    onclearall: () => void
    onfiles: (files: FileList) => void
  }

  const { arquivos, onremove, onclearall, onfiles }: Props = $props()

  let dragOver = $state(false)
  let fileInput = $state<HTMLInputElement | null>(null)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    if (e.dataTransfer?.files) onfiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dragOver = true
  }

  function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    if (input.files) onfiles(input.files)
  }
</script>

<div class="upload-layout">
  <div>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="drop-zone"
      class:drag-over={dragOver}
      onclick={() => fileInput?.click()}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={() => (dragOver = false)}
    >
      <div class="drop-icon">📂</div>
      <div class="drop-title">Soltar arquivos aqui</div>
      <div class="drop-sub">ou clique para selecionar<br>Varios arquivos de uma vez</div>
      <div class="drop-formats">
        <span class="fmt-badge">Inter CSV</span>
        <span class="fmt-badge">Nubank CSV</span>
      </div>
      <div class="upload-btn">Selecionar arquivos</div>
    </div>

    <input
      bind:this={fileInput}
      type="file"
      multiple
      accept=".csv"
      style="display:none"
      onchange={handleFileChange}
    />

    <div class="how-it-works">
      <div class="how-title">Como funciona</div>
      <div class="how-step">
        <div class="how-num">1</div>
        <div class="how-text"><strong>Selecione ou solte</strong> um ou mais arquivos CSV do Inter ou Nubank.</div>
      </div>
      <div class="how-step">
        <div class="how-num">2</div>
        <div class="how-text">O formato e detectado <strong>automaticamente</strong> pelo cabecalho do arquivo.</div>
      </div>
      <div class="how-step">
        <div class="how-num">3</div>
        <div class="how-text">Transacoes duplicadas sao <strong>ignoradas silenciosamente</strong>.</div>
      </div>
      <div class="how-step">
        <div class="how-num">4</div>
        <div class="how-text">Os dados sao salvos no <strong>navegador (IndexedDB)</strong> e persistem ao recarregar.</div>
      </div>
      <div class="how-step">
        <div class="how-num">5</div>
        <div class="how-text">Todas as abas sao <strong>atualizadas automaticamente</strong>.</div>
      </div>
    </div>
  </div>

  <div>
    <div class="uploaded-files">
      <div class="uf-title">
        <span>Arquivos carregados</span>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        {#if arquivos.length > 0}
          <span class="uf-clear" onclick={onclearall}>Remover todos</span>
        {/if}
      </div>

      {#if arquivos.length === 0}
        <div class="uf-empty">Nenhum arquivo ainda.</div>
      {:else}
        {#each arquivos as arq (arq.id)}
          <div class="uf-item">
            <div class="uf-icon">📄</div>
            <div class="uf-info">
              <div class="uf-name">{arq.nome}</div>
              <div class="uf-meta">{arq.meta}</div>
            </div>
            <span class="uf-status" class:uf-ok={arq.status === 'ok'} class:uf-warn={arq.status === 'warn'} class:uf-err={arq.status === 'err'}>
              {arq.status === 'ok' ? 'ok' : arq.status === 'warn' ? 'aviso' : 'erro'}
            </span>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="uf-remove" onclick={() => onremove(arq.id)}>×</div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>
