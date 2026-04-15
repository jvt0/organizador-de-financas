<script lang="ts">
  import Header from './components/Header.svelte'
  import Tabs, { type TabId } from './components/Tabs.svelte'
  import ResumoCards from './components/ResumoCards.svelte'
  import TabelaTransacoes from './components/TabelaTransacoes.svelte'
  import UploadZone from './components/UploadZone.svelte'

  // ── Navegação ─────────────────────────────────────────────────
  let activeTab = $state<TabId>('transacoes')

  // ── Dados mockados (substituídos pela engine na próxima iteração) ──
  const transacoesMock = [
    { data: '15/06/2025', destinatario: 'Padaria Central',    descricao: 'Pix enviado | Padaria Central',       valor:  -18.50, banco_origem: 'Nubank', propria: false },
    { data: '14/06/2025', destinatario: 'João Vitor Ramos',   descricao: 'Transferência entre contas',           valor: 1200.00, banco_origem: 'Inter',  propria: true  },
    { data: '13/06/2025', destinatario: 'Supermercado Alfa',  descricao: 'Débito | Supermercado Alfa LTDA',      valor: -234.90, banco_origem: 'Inter',  propria: false },
    { data: '12/06/2025', destinatario: 'Thiago Mendes',      descricao: 'Pix recebido - Thiago Mendes',        valor:  450.00, banco_origem: 'Nubank', propria: false },
  ]

  let arquivos = $state([
    { id: 'f1', nome: 'inter_junho_2025.csv',  meta: 'Inter · 3 transacoes',  status: 'ok'  as const },
    { id: 'f2', nome: 'nubank_junho_2025.csv', meta: 'Nubank · 1 transacao',  status: 'ok'  as const },
  ])

  // ── Métricas derivadas ────────────────────────────────────────
  const totalTransacoes = $derived(transacoesMock.length)
  const volume   = $derived(transacoesMock.reduce((a, t) => a + Math.abs(t.valor), 0))
  const entradas = $derived(transacoesMock.filter(t => t.valor > 0).reduce((a, t) => a + t.valor,  0))
  const saidas   = $derived(transacoesMock.filter(t => t.valor < 0).reduce((a, t) => a + Math.abs(t.valor), 0))

  // ── Toast ─────────────────────────────────────────────────────
  let toastMsg     = $state('')
  let toastColor   = $state('var(--green)')
  let toastVisible = $state(false)

  function showToast(msg: string, color = 'var(--green)') {
    toastMsg = msg; toastColor = color; toastVisible = true
    setTimeout(() => (toastVisible = false), 3500)
  }

  // ── Handlers UploadZone ───────────────────────────────────────
  function handleFiles(files: FileList) {
    // ligação com o pipeline real na próxima iteração
    console.log('files recebidos:', files.length)
    showToast(`${files.length} arquivo(s) recebido(s)`)
  }

  function handleRemove(id: string) {
    arquivos = arquivos.filter(a => a.id !== id)
    showToast('Arquivo removido', 'var(--red)')
  }

  function handleClearAll() {
    arquivos = []
    showToast('Todos os arquivos removidos', 'var(--red)')
  }
</script>

<Header {totalTransacoes} totalArquivos={arquivos.length} />

<div class="main">
  <Tabs active={activeTab} onchange={(tab) => (activeTab = tab)} />

  {#if activeTab === 'transacoes'}
    <ResumoCards {totalTransacoes} {volume} {entradas} {saidas} arquivos={arquivos.length} />
    <TabelaTransacoes transacoes={transacoesMock} ongoUpload={() => (activeTab = 'upload')} />

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
      {arquivos}
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
