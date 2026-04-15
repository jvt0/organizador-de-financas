<script lang="ts">
  interface Transacao {
    data: string
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

  let search     = $state('')
  let filterBanco = $state('')
  let filterTipo  = $state('')
  let filterPropria = $state('')
  let filterMinVal  = $state('')
  let sortKey = $state<'date' | 'val'>('date')
  let sortDir = $state<'asc' | 'desc'>('desc')
  let page = $state(0)

  function fmt(v: number): string {
    return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function fmtN(n: number): string {
    return n.toLocaleString('pt-BR')
  }

  const filtered: Transacao[] = $derived.by(() => {
    let rows = transacoes

    if (filterBanco)    rows = rows.filter(t => t.banco_origem === filterBanco)
    if (filterTipo === 'entrada') rows = rows.filter(t => t.valor > 0)
    if (filterTipo === 'saida')   rows = rows.filter(t => t.valor < 0)
    if (filterPropria === 'sim')  rows = rows.filter(t => t.propria)
    if (filterPropria === 'nao')  rows = rows.filter(t => !t.propria)
    if (filterMinVal)   rows = rows.filter(t => Math.abs(t.valor) >= Number(filterMinVal))
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(t =>
        t.destinatario.toLowerCase().includes(q) ||
        t.descricao.toLowerCase().includes(q)
      )
    }

    if (sortKey === 'date') {
      rows = [...rows].sort((a, b) =>
        sortDir === 'desc'
          ? b.data.localeCompare(a.data)
          : a.data.localeCompare(b.data)
      )
    } else {
      rows = [...rows].sort((a, b) =>
        sortDir === 'desc'
          ? Math.abs(b.valor) - Math.abs(a.valor)
          : Math.abs(a.valor) - Math.abs(b.valor)
      )
    }

    return rows
  })

  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)))
  const pageRows   = $derived(filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE))

  const totalEnt = $derived(filtered.filter(t => t.valor > 0).reduce((a, t) => a + t.valor, 0))
  const totalSai = $derived(filtered.filter(t => t.valor < 0).reduce((a, t) => a + Math.abs(t.valor), 0))

  function setSort(key: 'date' | 'val', dir: 'asc' | 'desc') {
    sortKey = key
    sortDir = dir
    page = 0
  }

  function resetPage() { page = 0 }
</script>

{#if transacoes.length === 0}
  <div class="empty-state">
    <div class="empty-icon">📂</div>
    <div class="empty-title">Nenhum extrato carregado</div>
    <div class="empty-sub">
      Adicione arquivos CSV do Inter ou Nubank<br>
      para comecar a visualizar suas transacoes.
    </div>
    <button class="empty-btn" onclick={ongoUpload}>Adicionar extratos</button>
  </div>
{:else}
  <div class="controls">
    <div class="cg">
      <div class="cl">Banco</div>
      <select bind:value={filterBanco} onchange={resetPage}>
        <option value="">Todos</option>
        <option>Nubank</option>
        <option>Inter</option>
      </select>
    </div>

    <div class="cg">
      <div class="cl">Tipo</div>
      <select bind:value={filterTipo} onchange={resetPage}>
        <option value="">Todos</option>
        <option value="entrada">Entradas</option>
        <option value="saida">Saidas</option>
      </select>
    </div>

    <div class="cg">
      <div class="cl">Conta</div>
      <select bind:value={filterPropria} onchange={resetPage}>
        <option value="">Todas</option>
        <option value="sim">Propria conta</option>
        <option value="nao">Terceiros</option>
      </select>
    </div>

    <div class="cg">
      <div class="cl">Valor min (R$)</div>
      <input
        type="number"
        placeholder="0"
        min="0"
        bind:value={filterMinVal}
        oninput={resetPage}
        style="width:100px"
      />
    </div>

    <div class="cg">
      <div class="cl">Buscar</div>
      <input
        type="text"
        placeholder="Nome ou descricao..."
        bind:value={search}
        oninput={resetPage}
        style="min-width:190px"
      />
    </div>

    <div class="sort-group">
      <div class="cl">Ordenar por</div>
      <div class="sort-btns">
        <button
          class="sb"
          class:active={sortKey === 'date' && sortDir === 'desc'}
          onclick={() => setSort('date', 'desc')}
        >Data recente</button>
        <button
          class="sb"
          class:active={sortKey === 'date' && sortDir === 'asc'}
          onclick={() => setSort('date', 'asc')}
        >Data antiga</button>
        <button
          class="sb"
          class:active={sortKey === 'val' && sortDir === 'desc'}
          onclick={() => setSort('val', 'desc')}
        >Maior valor</button>
        <button
          class="sb"
          class:active={sortKey === 'val' && sortDir === 'asc'}
          onclick={() => setSort('val', 'asc')}
        >Menor valor</button>
      </div>
    </div>
  </div>

  <div class="count-info">
    <span>{fmtN(filtered.length)} transacoes</span>
    <span class="totals">
      <span style="color:var(--green)">+{fmt(totalEnt)}</span>
      <span style="color:var(--red)">-{fmt(totalSai)}</span>
    </span>
  </div>

  <div class="table-container">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Destinatario</th>
            <th>Descricao</th>
            <th>Banco</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {#each pageRows as tx (tx.data + tx.destinatario + tx.valor)}
            <tr class:tr-own={tx.propria}>
              <td class="mono">{tx.data}</td>
              <td>
                {tx.destinatario}
                {#if tx.propria}
                  <span class="badge b-own" style="margin-left:6px">própria</span>
                {/if}
              </td>
              <td style="color:var(--muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {tx.descricao}
              </td>
              <td>
                <span class="badge" class:b-nu={tx.banco_origem === 'Nubank'} class:b-inter={tx.banco_origem === 'Inter'}>
                  {tx.banco_origem}
                </span>
              </td>
              <td class={tx.valor >= 0 ? 'valor-pos' : 'valor-neg'}>
                {tx.valor >= 0 ? '+' : '-'}{fmt(tx.valor)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if totalPages > 1}
      <div class="pagination">
        <button
          class="pb"
          disabled={page === 0}
          onclick={() => page--}
        >&#8592;</button>

        {#each Array.from({ length: totalPages }, (_, i) => i) as i (i)}
          {#if i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2}
            <button
              class="pb"
              class:active={i === page}
              onclick={() => (page = i)}
            >{i + 1}</button>
          {:else if Math.abs(i - page) === 3}
            <span class="pi">…</span>
          {/if}
        {/each}

        <button
          class="pb"
          disabled={page === totalPages - 1}
          onclick={() => page++}
        >&#8594;</button>
      </div>
    {/if}
  </div>
{/if}
