<script lang="ts">
  import Header from './components/Header.svelte'
  import Tabs, { type TabId } from './components/Tabs.svelte'
  import ResumoCards from './components/ResumoCards.svelte'
  import TabelaTransacoes from './components/TabelaTransacoes.svelte'
  import UploadZone from './components/UploadZone.svelte'

  // ── Estado global da aba ─────────────────────────────────────
  let activeTab = $state<TabId>('transacoes')

  // ── Dados mockados para validar renderização visual ──────────
  const transacoesMock = [
    {
      data: '15/06/2025',
      destinatario: 'Padaria Central',
      descricao: 'Pix enviado | Padaria Central',
      valor: -18.50,
      banco_origem: 'Nubank',
      propria: false,
    },
    {
      data: '14/06/2025',
      destinatario: 'João Vitor Ramos',
      descricao: 'Transferência entre contas',
      valor: 1200.00,
      banco_origem: 'Inter',
      propria: true,
    },
    {
      data: '13/06/2025',
      destinatario: 'Supermercado Alfa',
      descricao: 'Débito | Supermercado Alfa LTDA',
      valor: -234.90,
      banco_origem: 'Inter',
      propria: false,
    },
    {
      data: '12/06/2025',
      destinatario: 'Thiago Mendes',
      descricao: 'Pix recebido - Thiago Mendes',
      valor: 450.00,
      banco_origem: 'Nubank',
      propria: false,
    },
  ]

  // ── Arquivos mockados para UploadZone ────────────────────────
  let arquivosMock = $state([
    { id: 'f1', nome: 'inter_junho_2025.csv',  meta: 'Inter · 3 transacoes',   status: 'ok'   as const },
    { id: 'f2', nome: 'nubank_junho_2025.csv', meta: 'Nubank · 1 transacao',   status: 'ok'   as const },
  ])

  // ── Métricas derivadas ───────────────────────────────────────
  const totalTransacoes = $derived(transacoesMock.length)
  const volume    = $derived(transacoesMock.reduce((a, t) => a + Math.abs(t.valor), 0))
  const entradas  = $derived(transacoesMock.filter(t => t.valor > 0).reduce((a, t) => a + t.valor, 0))
  const saidas    = $derived(transacoesMock.filter(t => t.valor < 0).reduce((a, t) => a + Math.abs(t.valor), 0))

  // ── Handlers UploadZone ──────────────────────────────────────
  function handleFiles(_files: FileList) {
    // ligação com o pipeline real na próxima iteração
    console.log('files received:', _files.length)
  }

  function handleRemove(id: string) {
    arquivosMock = arquivosMock.filter(a => a.id !== id)
  }

  function handleClearAll() {
    arquivosMock = []
  }
</script>

<Header
  {totalTransacoes}
  totalArquivos={arquivosMock.length}
/>

<div class="main">
  <Tabs active={activeTab} onchange={(tab) => (activeTab = tab)} />

  {#if activeTab === 'transacoes'}
    <ResumoCards {totalTransacoes} {volume} {entradas} {saidas} arquivos={arquivosMock.length} />
    <TabelaTransacoes
      transacoes={transacoesMock}
      ongoUpload={() => (activeTab = 'upload')}
    />

  {:else if activeTab === 'pessoas'}
    <div class="empty-state">
      <div class="empty-icon">👤</div>
      <div class="empty-title">Nenhum extrato carregado</div>
      <div class="empty-sub">
        Carregue seus extratos para ver o ranking<br>
        de pessoas e entidades com quem voce transacionou.
      </div>
      <button class="empty-btn" onclick={() => (activeTab = 'upload')}>Adicionar extratos</button>
    </div>

  {:else if activeTab === 'padroes'}
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <div class="empty-title">Nenhum extrato carregado</div>
      <div class="empty-sub">
        Carregue seus extratos para identificar<br>
        padroes, rankings e observacoes automaticas.
      </div>
      <button class="empty-btn" onclick={() => (activeTab = 'upload')}>Adicionar extratos</button>
    </div>

  {:else if activeTab === 'upload'}
    <UploadZone
      arquivos={arquivosMock}
      onremove={handleRemove}
      onclearall={handleClearAll}
      onfiles={handleFiles}
    />
  {/if}
</div>
