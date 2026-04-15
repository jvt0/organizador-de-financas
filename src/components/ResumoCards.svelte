<script lang="ts">
  interface Props {
    totalTransacoes: number
    volume:   number
    entradas: number
    saidas:   number
    arquivos: number
  }

  const { totalTransacoes, volume, entradas, saidas, arquivos }: Props = $props()

  function fmt(v: number): string {
    return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const cards = $derived([
    { label: 'Total transacoes', value: totalTransacoes.toLocaleString('pt-BR'), colorClass: 'cv-blue'   },
    { label: 'Volume total',     value: fmt(volume),                             colorClass: 'cv-yellow' },
    { label: 'Total entradas',   value: fmt(entradas),                           colorClass: 'cv-green'  },
    { label: 'Total saidas',     value: fmt(saidas),                             colorClass: 'cv-red'    },
    { label: 'Arquivos',         value: arquivos.toLocaleString('pt-BR'),        colorClass: 'cv-purple' },
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

<style>
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
    gap: 11px;
    margin-bottom: 20px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 15px 17px;
  }
  .card-label {
    font-size: 10px;
    font-family: 'IBM Plex Mono', monospace;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: .8px;
    margin-bottom: 5px;
  }
  .card-value {
    font-size: 19px;
    font-family: 'IBM Plex Mono', monospace;
    font-weight: 600;
  }
  .cv-yellow { color: var(--accent);  }
  .cv-green  { color: var(--green);   }
  .cv-red    { color: var(--red);     }
  .cv-blue   { color: var(--blue);    }
  .cv-purple { color: var(--purple);  }
</style>
