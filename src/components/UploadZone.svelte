<script lang="ts">
  export interface ArquivoCarregado {
    id: string
    nome: string
    meta: string
    status: 'ok' | 'warn' | 'err'
  }

  interface Props {
    arquivos: ArquivoCarregado[]
    onremove:   (id: string) => void
    onclearall: () => void
    onfiles:    (files: FileList) => void
  }

  const { arquivos, onremove, onclearall, onfiles }: Props = $props()

  let dragOver = $state(false)

  const statusLabel: Record<ArquivoCarregado['status'], string> = {
    ok:   'ok',
    warn: 'aviso',
    err:  'erro',
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    if (e.dataTransfer?.files?.length) {
      for (const file of Array.from(e.dataTransfer.files)) {
        console.log('[DEBUG] 1. Arquivo recebido na UI (drop):', file.name)
      }
      onfiles(e.dataTransfer.files)
    }
  }

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    if (input.files?.length) {
      for (const file of Array.from(input.files)) {
        console.log('[DEBUG] 1. Arquivo recebido na UI (input):', file.name)
      }
      onfiles(input.files)
    }
  }
</script>

<div class="upload-layout">

  <!-- Coluna esquerda: drop zone + instrucoes -->
  <div>
    <!--
      <label> é o elemento semântico correto para acionar um file input.
      O clique na label dispara o input nativo sem JavaScript adicional.
    -->
    <label
      class="drop-zone"
      class:drag-over={dragOver}
      for="file-upload"
      ondrop={handleDrop}
      ondragover={(e) => { e.preventDefault(); dragOver = true }}
      ondragleave={() => (dragOver = false)}
    >
      <div class="drop-icon">📂</div>
      <div class="drop-title">Soltar arquivos aqui</div>
      <div class="drop-sub">ou clique para selecionar<br>Varios arquivos de uma vez</div>
      <div class="drop-formats">
        <span class="fmt-badge">Inter CSV</span>
        <span class="fmt-badge">Nubank CSV</span>
      </div>
      <span class="upload-btn">Selecionar arquivos</span>
    </label>

    <input
      id="file-upload"
      type="file"
      multiple
      accept=".csv"
      style="display:none"
      onchange={handleFileChange}
    />

    <div class="how-it-works">
      <p class="how-title">Como funciona</p>
      <div class="how-step">
        <span class="how-num">1</span>
        <p class="how-text"><strong>Selecione ou solte</strong> um ou mais arquivos CSV do Inter ou Nubank.</p>
      </div>
      <div class="how-step">
        <span class="how-num">2</span>
        <p class="how-text">O formato e detectado <strong>automaticamente</strong> pelo cabecalho do arquivo.</p>
      </div>
      <div class="how-step">
        <span class="how-num">3</span>
        <p class="how-text">Transacoes duplicadas sao <strong>ignoradas silenciosamente</strong>.</p>
      </div>
      <div class="how-step">
        <span class="how-num">4</span>
        <p class="how-text">Os dados sao salvos no <strong>navegador (IndexedDB)</strong> e persistem ao recarregar.</p>
      </div>
      <div class="how-step">
        <span class="how-num">5</span>
        <p class="how-text">Todas as abas sao <strong>atualizadas automaticamente</strong>.</p>
      </div>
    </div>
  </div>

  <!-- Coluna direita: lista de arquivos carregados -->
  <div>
    <div class="uploaded-files">
      <div class="uf-title">
        <span>Arquivos carregados</span>
        {#if arquivos.length > 0}
          <button type="button" class="uf-clear" onclick={onclearall}>Remover todos</button>
        {/if}
      </div>

      {#if arquivos.length === 0}
        <p class="uf-empty">Nenhum arquivo ainda.</p>
      {:else}
        {#each arquivos as arq (arq.id)}
          <div class="uf-item">
            <span class="uf-icon" aria-hidden="true">📄</span>
            <div class="uf-info">
              <p class="uf-name">{arq.nome}</p>
              <p class="uf-meta">{arq.meta}</p>
            </div>
            <span class="uf-status {`uf-${arq.status}`}">{statusLabel[arq.status]}</span>
            <button type="button" class="uf-remove" aria-label="Remover {arq.nome}" onclick={() => onremove(arq.id)}>
              ×
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>

</div>

<style>
  .upload-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  /* ── Drop zone (label semântica) ── */
  .drop-zone {
    display: block;
    border: 2px dashed var(--border);
    border-radius: 12px;
    padding: 48px 32px;
    text-align: center;
    cursor: pointer;
    transition: all .2s;
    background: var(--surface);
  }
  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: var(--accent);
    background: #1a1800;
  }
  .drop-icon  { font-size: 36px; margin-bottom: 12px; opacity: .6; display: block; }
  .drop-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 6px;
  }
  .drop-sub { font-size: 12px; color: var(--muted); line-height: 1.6; }

  .drop-formats {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .fmt-badge {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .upload-btn {
    display: inline-block;
    margin-top: 16px;
    padding: 9px 20px;
    background: var(--accent);
    color: #000;
    border-radius: 7px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity .15s;
  }
  .drop-zone:hover .upload-btn { opacity: .85; }

  /* ── Como funciona ── */
  .how-it-works {
    margin-top: 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .how-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .8px;
    margin-bottom: 14px;
  }
  .how-step {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    align-items: flex-start;
  }
  .how-step:last-child { margin-bottom: 0; }
  .how-num {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    background: #f0c04018;
    border: 1px solid #f0c04050;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .how-text { font-size: 13px; color: var(--muted); line-height: 1.6; }
  .how-text strong { color: var(--text); }

  /* ── Lista de arquivos carregados ── */
  .uploaded-files {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
  }
  .uf-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .8px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* botão "Remover todos" */
  .uf-clear {
    background: transparent;
    border: 1px solid #e05c5c40;
    cursor: pointer;
    color: var(--red);
    font-size: 10px;
    font-family: inherit;
    padding: 3px 8px;
    border-radius: 4px;
    transition: all .15s;
  }
  .uf-clear:hover { background: #e05c5c18; }

  .uf-empty { color: var(--muted); font-size: 13px; text-align: center; padding: 28px 0; }

  .uf-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 7px;
    border: 1px solid var(--border);
    margin-bottom: 8px;
    background: var(--bg);
  }
  .uf-item:last-child { margin-bottom: 0; }
  .uf-icon { font-size: 18px; flex-shrink: 0; }
  .uf-info { flex: 1; min-width: 0; }
  .uf-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uf-meta { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); margin-top: 2px; }

  /* botão "×" de remover */
  .uf-remove {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted);
    font-size: 16px;
    font-family: inherit;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all .15s;
    flex-shrink: 0;
    line-height: 1;
  }
  .uf-remove:hover { color: var(--red); background: #e05c5c18; }

  .uf-status {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .uf-ok   { background: #4caf7d18; color: var(--green); border: 1px solid #4caf7d40; }
  .uf-warn { background: #f0c04018; color: var(--accent); border: 1px solid #f0c04050; }
  .uf-err  { background: #e05c5c18; color: var(--red);   border: 1px solid #e05c5c40; }
</style>
