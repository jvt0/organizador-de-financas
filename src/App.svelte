<script lang="ts">
  import Header from './components/Header.svelte'
  import Tabs, { type TabId } from './components/Tabs.svelte'
  import ResumoCards from './components/ResumoCards.svelte'
  import TabelaTransacoes from './components/TabelaTransacoes.svelte'
  import UploadZone from './components/UploadZone.svelte'
  import { financeStore } from './stores/financeStore.svelte'

  // ── Navegação ─────────────────────────────────────────────────
  let activeTab = $state<TabId>('transacoes')

  // ── Métricas derivadas do store real ──────────────────────────
  const totalTransacoes = $derived(financeStore.transacoes.length)
  const volume   = $derived(financeStore.transacoes.reduce((a, t) => a + Math.abs(t.valor), 0))
  const entradas = $derived(financeStore.transacoes.filter(t => t.valor > 0).reduce((a, t) => a + t.valor, 0))
  const saidas   = $derived(financeStore.transacoes.filter(t => t.valor < 0).reduce((a, t) => a + Math.abs(t.valor), 0))

  // ── Toast ─────────────────────────────────────────────────────
  let toastMsg     = $state('')
  let toastColor   = $state('var(--green)')
  let toastVisible = $state(false)

  function showToast(msg: string, color = 'var(--green)') {
    toastMsg = msg; toastColor = color; toastVisible = true
    setTimeout(() => (toastVisible = false), 3500)
  }

  // ── Handlers UploadZone → store ───────────────────────────────
  async function handleFiles(files: FileList) {
    await financeStore.processUpload(files)
    if (financeStore.error) {
      showToast(financeStore.error, 'var(--red)')
    } else {
      showToast(`Importação concluída — ${financeStore.transacoes.length} transações no total`)
    }
  }

  async function handleRemove(id: string) {
    await financeStore.removeFile(id)
    showToast('Arquivo removido', 'var(--red)')
  }

  async function handleClearAll() {
    await financeStore.clearAll()
    showToast('Todos os arquivos removidos', 'var(--red)')
  }
</script>

<Header {totalTransacoes} totalArquivos={financeStore.arquivos.length} />

<div class="main">
  <Tabs active={activeTab} onchange={(tab) => (activeTab = tab)} />

  {#if activeTab === 'transacoes'}
    <ResumoCards {totalTransacoes} {volume} {entradas} {saidas} arquivos={financeStore.arquivos.length} />
    <TabelaTransacoes transacoes={financeStore.transacoes} ongoUpload={() => (activeTab = 'upload')} />

  {:else if activeTab === 'pessoas'}
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-title">Nenhum extrato carregado</div>
      <div class="empty-sub">
        Carregue seus extratos para ver o ranking<br>
        de pessoas e entidades com quem voce transacionou.
      </div>
      <button type="button" class="empty-btn" onclick={() => (activeTab = 'upload')}>
        Adicionar extratos
      </button>
    </div>

  {:else if activeTab === 'padroes'}
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <div class="empty-title">Nenhum extrato carregado</div>
      <div class="empty-sub">
        Carregue seus extratos para identificar<br>
        padroes, rankings e observacoes automaticas.
      </div>
      <button type="button" class="empty-btn" onclick={() => (activeTab = 'upload')}>
        Adicionar extratos
      </button>
    </div>

  {:else if activeTab === 'upload'}
    <UploadZone
      arquivos={financeStore.arquivos}
      onremove={handleRemove}
      onclearall={handleClearAll}
      onfiles={handleFiles}
    />
  {/if}
</div>

<!-- Toast global -->
<div class="toast" class:show={toastVisible} role="status" aria-live="polite">
  <div class="toast-dot" style="background:{toastColor}"></div>
  <span>{toastMsg}</span>
</div>

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 18px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    transform: translateY(80px);
    opacity: 0;
    transition: all .3s;
    pointer-events: none;
    max-width: 360px;
  }
  .toast.show { transform: translateY(0); opacity: 1; }
  .toast-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
</style>
