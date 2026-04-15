<script lang="ts">
  interface Card {
    label: string
    value: string
    colorClass: string
  }

  interface Props {
    totalTransacoes: number
    volume: number
    entradas: number
    saidas: number
    arquivos: number
  }

  const { totalTransacoes, volume, entradas, saidas, arquivos }: Props = $props()

  function fmt(v: number): string {
    return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function fmtN(n: number): string {
    return n.toLocaleString('pt-BR')
  }

  const cards: Card[] = $derived([
    { label: 'Total transacoes', value: fmtN(totalTransacoes), colorClass: 'cv-blue'   },
    { label: 'Volume total',     value: fmt(volume),           colorClass: 'cv-yellow' },
    { label: 'Total entradas',   value: fmt(entradas),         colorClass: 'cv-green'  },
    { label: 'Total saidas',     value: fmt(saidas),           colorClass: 'cv-red'    },
    { label: 'Arquivos',         value: fmtN(arquivos),        colorClass: 'cv-purple' },
  ])
</script>

<div class="summary-grid">
  {#each cards as card (card.label)}
    <div class="card">
      <div class="card-label">{card.label}</div>
      <div class="card-value {card.colorClass}">{card.value}</div>
    </div>
  {/each}
</div>
