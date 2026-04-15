<script lang="ts">
  interface Props {
    totalTransacoes: number
    totalArquivos: number
  }

  const { totalTransacoes, totalArquivos }: Props = $props()

  const loaded = $derived(totalTransacoes > 0)

  const badgeText = $derived(
    loaded
      ? `${totalTransacoes.toLocaleString('pt-BR')} transacoes | ${totalArquivos} arquivo(s)`
      : 'nenhum extrato carregado'
  )
</script>

<header>
  <div>
    <h1>// EXTRATO COMPLETO</h1>
    <p>Analise de extratos bancarios &nbsp;&middot;&nbsp; Inter e Nubank</p>
  </div>
  <div class="header-right">
    <div class="extra-badge" class:loaded>{badgeText}</div>
  </div>
</header>

<style>
  header {
    padding: 22px 40px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  h1 {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
    white-space: nowrap;
  }
  p { color: var(--muted); font-size: 12px; margin-top: 2px; }

  .header-right { display: flex; align-items: center; gap: 10px; }

  .extra-badge {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 4px 10px;
    white-space: nowrap;
  }
  .extra-badge.loaded {
    color: var(--green);
    background: #4caf7d18;
    border-color: #4caf7d40;
  }
</style>
