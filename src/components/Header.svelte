<script lang="ts">
  interface Props {
    totalTransacoes: number
    totalArquivos: number
  }

  const { totalTransacoes, totalArquivos }: Props = $props()

  const loaded = $derived(totalTransacoes > 0)

  function fmtN(n: number): string {
    return n.toLocaleString('pt-BR')
  }

  const badgeText = $derived(
    loaded
      ? `${fmtN(totalTransacoes)} transacoes | ${totalArquivos} arquivo(s)`
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
