<script lang="ts">
  export interface Transacao {
    id: string
    data: string
    tipo: 'entrada' | 'saida'
    destinatario: string
    descricao: string
    valor: number
    banco_origem: string
    propria: boolean
  }

  interface Props {
    transacoes: Transacao[]
    ongoUpload: () => void
  }

  const { transacoes, ongoUpload }: Props = $props()

  const PAGE_SIZE = 200

  // ── Filtros ──────────────────────────────────────────────────
  let filterBanco   = $state('')
  let filterTipo    = $state('')
  let filterPropria = $state('')
  let filterMinVal  = $state('')
  let search        = $state('')

  // ── Ordenação ────────────────────────────────────────────────
  let sortKey = $state<'date' | 'val'>('date')
  let sortDir = $state<'asc' | 'desc'>('desc')

  // ── Paginação ────────────────────────────────────────────────
  let page = $state(0)
  function resetPage() { page = 0 }
  function setSort(key: 'date' | 'val', dir: 'asc' | 'desc') {
    sortKey = key; sortDir = dir; resetPage()
  }

  // ── Pipeline de filtros nomeados ─────────────────────────────
  const byBanco = $derived(
    filterBanco
      ? transacoes.filter(t => t.banco_origem === filterBanco)
      : transacoes
  )

  const byTipo = $derived(
    filterTipo === 'entrada' ? byBanco.filter(t => t.valor > 0) :
    filterTipo === 'saida'   ? byBanco.filter(t => t.valor < 0) :
    byBanco
  )

  const byPropria = $derived(
    filterPropria === 'sim' ? byTipo.filter(t =>  t.propria) :
    filterPropria === 'nao' ? byTipo.filter(t => !t.propria) :
    byTipo
  )

  const byMinVal = $derived(
    filterMinVal
      ? byPropria.filter(t => Math.abs(t.valor) >= Number(filterMinVal))
      : byPropria
  )

  const bySearch = $derived(
    search
      ? byMinVal.filter(t => {
          const q = search.toLowerCase()
          return t.destinatario.toLowerCase().includes(q)
              || t.descricao.toLowerCase().includes(q)
        })
      : byMinVal
  )

  const sorted: Transacao[] = $derived.by(() => {
    const rows = [...bySearch]
    if (sortKey === 'date') {
      return rows.sort((a, b) =>
        sortDir === 'desc'
          ? b.data.localeCompare(a.data)
          : a.data.localeCompare(b.data)
      )
    }
    return rows.sort((a, b) =>
      sortDir === 'desc'
        ? Math.abs(b.valor) - Math.abs(a.valor)
        : Math.abs(a.valor) - Math.abs(b.valor)
    )
  })

  // ── Métricas e paginação derivadas ───────────────────────────
  const totalPages = $derived(Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)))
  const pageRows   = $derived(sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE))
  const totalEnt   = $derived(sorted.filter(t => t.valor > 0).reduce((a, t) => a + t.valor, 0))
  const totalSai   = $derived(sorted.filter(t => t.valor < 0).reduce((a, t) => a + Math.abs(t.valor), 0))

  // ── Utilitários de formatação ─────────────────────────────────
  function fmt(v: number): string {
    return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  /** Converte ISO 'yyyy-MM-dd' para 'dd/MM/yyyy'. Retorna a string original se já estiver em outro formato. */
  function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return d && m && y ? `${d}/${m}/${y}` : iso
  }
</script>

<!-- ── Snippets reutilizáveis ───────────────────────────────── -->

{#snippet bancoBadge(banco: string)}
  {#if banco === 'Nubank'}
    <span class="badge b-nu">Nubank</span>
  {:else if banco === 'Inter'}
    <span class="badge b-inter">Inter</span>
  {:else}
    <span class="badge">{banco}</span>
  {/if}
{/snippet}

{#snippet valorCell(valor: number)}
  <td class={valor >= 0 ? 'valor-pos' : 'valor-neg'}>
    {valor >= 0 ? '+' : '-'}{fmt(valor)}
  </td>
{/snippet}

<!-- ── Template ─────────────────────────────────────────────── -->

{#if transacoes.length === 0}
  <div class="empty-state">
    <div class="empty-icon">📂</div>
    <div class="empty-title">Nenhum extrato carregado</div>
    <div class="empty-sub">
      Adicione arquivos CSV do Inter ou Nubank<br>
      para comecar a visualizar suas transacoes.
    </div>
    <button type="button" class="empty-btn" onclick={ongoUpload}>
      Adicionar extratos
    </button>
  </div>
{:else}

  <!-- Controles -->
  <div class="controls">
    <div class="cg">
      <label class="cl" for="f-banco">Banco</label>
      <select id="f-banco" bind:value={filterBanco} onchange={resetPage}>
        <option value="">Todos</option>
        <option>Nubank</option>
        <option>Inter</option>
      </select>
    </div>

    <div class="cg">
      <label class="cl" for="f-tipo">Tipo</label>
      <select id="f-tipo" bind:value={filterTipo} onchange={resetPage}>
        <option value="">Todos</option>
        <option value="entrada">Entradas</option>
        <option value="saida">Saidas</option>
      </select>
    </div>

    <div class="cg">
      <label class="cl" for="f-propria">Conta</label>
      <select id="f-propria" bind:value={filterPropria} onchange={resetPage}>
        <option value="">Todas</option>
        <option value="sim">Propria conta</option>
        <option value="nao">Terceiros</option>
      </select>
    </div>

    <div class="cg">
      <label class="cl" for="f-minval">Valor min (R$)</label>
      <input
        id="f-minval"
        type="number"
        placeholder="0"
        min="0"
        bind:value={filterMinVal}
        oninput={resetPage}
        style="width:100px"
      />
    </div>

    <div class="cg">
      <label class="cl" for="f-search">Buscar</label>
      <input
        id="f-search"
        type="text"
        placeholder="Nome ou descricao..."
        bind:value={search}
        oninput={resetPage}
        style="min-width:190px"
      />
    </div>

    <div class="sort-group">
      <span class="cl">Ordenar por</span>
      <div class="sort-btns">
        <button type="button" class="sb" class:active={sortKey==='date'&&sortDir==='desc'} onclick={() => setSort('date','desc')}>Data recente</button>
        <button type="button" class="sb" class:active={sortKey==='date'&&sortDir==='asc'}  onclick={() => setSort('date','asc')} >Data antiga</button>
        <button type="button" class="sb" class:active={sortKey==='val'&&sortDir==='desc'}  onclick={() => setSort('val','desc')} >Maior valor</button>
        <button type="button" class="sb" class:active={sortKey==='val'&&sortDir==='asc'}   onclick={() => setSort('val','asc')}  >Menor valor</button>
      </div>
    </div>
  </div>

  <!-- Contagem + totais -->
  <div class="count-info">
    <span>{sorted.length.toLocaleString('pt-BR')} transacoes</span>
    <span class="totals">
      <span style="color:var(--green)">+{fmt(totalEnt)}</span>
      <span style="color:var(--red)">-{fmt(totalSai)}</span>
    </span>
  </div>

  <!-- Tabela -->
  <div class="table-container">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Destinatario</th>
            <th>Descricao</th>
            <th>Banco</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as tx (tx.id)}
            <tr class:tr-own={tx.propria}>
              <td class="mono">{fmtDate(tx.data)}</td>
              <td><span class="badge tipo-{tx.tipo}">{tx.tipo === 'entrada' ? 'ENTRADA' : 'SAÍDA'}</span></td>
              <td>
                {tx.destinatario}
                {#if tx.propria}<span class="badge b-own" style="margin-left:6px">própria</span>{/if}
              </td>
              <td class="desc-cell">{tx.descricao}</td>
              <td>{@render bancoBadge(tx.banco_origem)}</td>
              {@render valorCell(tx.valor)}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <nav class="pagination" aria-label="Paginação">
        <button type="button" class="pb" disabled={page === 0} onclick={() => page--}>&#8592;</button>

        {#each { length: totalPages } as _, i (i)}
          {#if i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2}
            <button type="button" class="pb" class:active={i === page} onclick={() => (page = i)}>
              {i + 1}
            </button>
          {:else if Math.abs(i - page) === 3}
            <span class="pi">…</span>
          {/if}
        {/each}

        <button type="button" class="pb" disabled={page === totalPages - 1} onclick={() => page++}>&#8594;</button>
      </nav>
    {/if}
  </div>
{/if}

<style>
  /* ── Controles ── */
  .controls {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: flex-end;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 13px 17px;
    margin-bottom: 16px;
  }
  .cg { display: flex; flex-direction: column; gap: 4px; }
  .cl {
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .6px;
  }

  select,
  input[type='text'],
  input[type='number'] {
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 7px 10px;
    border-radius: 6px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    outline: none;
    transition: border .15s;
  }
  select:focus, input:focus { border-color: var(--accent); }

  .sort-group { display: flex; flex-direction: column; gap: 4px; margin-left: auto; }
  .sort-btns  { display: flex; gap: 5px; flex-wrap: wrap; }

  .sb {
    /* reset */
    background: var(--bg);
    border: 1px solid var(--border);
    /* visual */
    padding: 7px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    transition: all .15s;
    white-space: nowrap;
  }
  .sb.active            { background: var(--accent); color: #000; border-color: var(--accent); }
  .sb:hover:not(.active){ color: var(--text); border-color: var(--muted); }

  /* ── Contagem ── */
  .count-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .count-info span {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
  }
  .totals { display: flex; gap: 18px; }

  /* ── Tabela ── */
  .table-container { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .table-wrap      { overflow-x: auto; max-height: 66vh; overflow-y: auto; }

  table           { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead           { position: sticky; top: 0; z-index: 10; }
  th {
    text-align: left;
    padding: 10px 13px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .8px;
    color: var(--muted);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
    cursor: pointer;
  }
  th:hover { color: var(--text); }
  td       { padding: 9px 13px; border-bottom: 1px solid #1a1d23; vertical-align: middle; }
  tr:last-child td        { border-bottom: none; }
  tr:hover td             { background: var(--surface2); }
  .tr-own td              { background: #1a1800; }
  .tr-own:hover td        { background: #1f1e00; }

  .desc-cell {
    color: var(--muted);
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .valor-pos {
    color: var(--green);
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
    white-space: nowrap;
  }
  .valor-neg {
    color: var(--red);
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
    white-space: nowrap;
  }
  .mono { font-family: 'IBM Plex Mono', monospace; }

  /* ── Badges ── */
  .badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
    white-space: nowrap;
  }
  .b-nu         { background: #8c56e618; color: #b892ff;        border: 1px solid #8c56e640; }
  .b-inter      { background: #ff6b2218; color: #ff9966;        border: 1px solid #ff6b2240; }
  .b-own        { background: #f0c04018; color: var(--accent);  border: 1px solid #f0c04050; }
  .tipo-entrada { background: #4caf7d18; color: var(--green);   border: 1px solid #4caf7d40; }
  .tipo-saida   { background: #e05c5c18; color: var(--red);     border: 1px solid #e05c5c40; }

  /* ── Paginação ── */
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px;
    border-top: 1px solid var(--border);
    background: var(--surface);
    flex-wrap: wrap;
  }
  .pb {
    /* reset */
    background: transparent;
    border: 1px solid var(--border);
    /* visual */
    padding: 5px 11px;
    border-radius: 5px;
    cursor: pointer;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
    transition: all .15s;
  }
  .pb:hover:not(:disabled) { color: var(--text); border-color: var(--muted); }
  .pb.active               { background: var(--accent); color: #000; border-color: var(--accent); }
  .pb:disabled             { opacity: .3; cursor: default; }
  .pi { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: var(--muted); padding: 0 4px; }
</style>
