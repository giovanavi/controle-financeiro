import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { hojeISO, mesAtual, mesParaISO, somarMeses } from '../utils/meses'
import {
  DIAS_DE_AVISO,
  estadoConta,
  hojeLocal,
  somarDias,
  vencimentoDaFatura,
} from '../utils/vencimentos'
import { carregarOrcamentoMes } from '../utils/orcamento'
import '../contas.css'

const AvisosContext = createContext(null)

export function useAvisos() {
  return useContext(AvisosContext)
}

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

// quanto as outras pessoas ainda devem de uma lista de lançamentos
function valorAReceber(lancamentos) {
  return soma(
    lancamentos.flatMap((l) => l.lancamento_participacoes),
    (p) => (!p.pessoas?.eh_eu && !p.pago ? p.valor_centavos : 0)
  )
}

export function AvisosProvider({ children }) {
  const [itens, setItens] = useState([])
  const [semVencimento, setSemVencimento] = useState(0)
  const [orcamento, setOrcamento] = useState({ linhas: [], semCategoria: 0 })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const local = useLocation()

  const recarregar = useCallback(async () => {
    const hoje = hojeLocal()
    const horizonte = somarDias(hoje, 60) // contas a vencer nos próximos 60 dias
    const recente = mesParaISO(somarMeses(mesAtual(), -2)) // pagas dos últimos meses
    const fimFaturas = mesParaISO(somarMeses(mesAtual(), 2))
    const inicioMes = mesParaISO(mesAtual())
    const fimMesSeguinte = mesParaISO(somarMeses(mesAtual(), 1))

    const [f, l, s] = await Promise.all([
      supabase
        .from('faturas')
        .select(
          'id, mes_referencia, status, pago_em, cartoes(id, nome, dia_vencimento), lancamentos(valor_centavos, lancamento_participacoes(valor_centavos, pago, pessoas(eh_eu))), fatura_encargos(valor_centavos)'
        )
        .or(`status.eq.aberta,mes_referencia.gte.${recente}`)
        .lte('mes_referencia', fimFaturas),
      supabase
        .from('lancamentos')
        .select(
          'id, valor_centavos, vencimento, conta_paga, conta_paga_em, valor_estimado, mes_referencia, despesas!inner(descricao, tipo), lancamento_participacoes(valor_centavos, pago, pessoas(eh_eu))'
        )
        .in('despesas.tipo', ['fixo', 'extra'])
        .not('vencimento', 'is', null)
        .lte('vencimento', horizonte)
        .or(`conta_paga.eq.false,vencimento.gte.${recente}`),
      supabase
        .from('lancamentos')
        .select('id, despesas!inner(tipo)', { count: 'exact', head: true })
        .in('despesas.tipo', ['fixo', 'extra'])
        .is('vencimento', null)
        .eq('conta_paga', false)
        .gte('mes_referencia', inicioMes)
        .lte('mes_referencia', fimMesSeguinte),
    ])

    if (f.error || l.error) {
      setErro('Não foi possível carregar as contas a pagar.')
      setCarregando(false)
      return
    }
    setErro('')
    setSemVencimento(s.error ? 0 : s.count ?? 0)

    const dasFaturas = f.data
      .map((x) => {
        const valor =
          soma(x.lancamentos, (y) => y.valor_centavos) + soma(x.fatura_encargos, (y) => y.valor_centavos)
        return {
          chave: `f-${x.id}`,
          origem: 'cartao',
          id: x.id,
          nome: `Fatura ${x.cartoes.nome}`,
          tipo: 'cartao',
          venc: vencimentoDaFatura(x.mes_referencia, x.cartoes.dia_vencimento),
          valor,
          paga: x.status === 'paga',
          pagaEm: x.pago_em,
          estimado: false,
          receber: valorAReceber(x.lancamentos),
          para: `/cartoes/${x.cartoes.id}?mes=${x.mes_referencia}`,
        }
      })
      .filter((i) => i.valor > 0 && (i.paga ? i.venc >= recente : i.venc <= horizonte))

    const dosLancamentos = l.data.map((x) => ({
      chave: `l-${x.id}`,
      origem: 'lancamento',
      id: x.id,
      nome: x.despesas.descricao,
      tipo: x.despesas.tipo,
      venc: x.vencimento,
      valor: x.valor_centavos,
      paga: x.conta_paga,
      pagaEm: x.conta_paga_em,
      estimado: x.valor_estimado,
      receber: valorAReceber([x]),
      para: `/${x.despesas.tipo === 'fixo' ? 'fixos' : 'extras'}?mes=${x.mes_referencia}`,
    }))

    const todos = [...dasFaturas, ...dosLancamentos]
      .map((i) => ({ ...i, est: estadoConta({ venc: i.venc, paga: i.paga, pagaEm: i.pagaEm }) }))
      .sort((a, b) => a.venc.localeCompare(b.venc))

    setItens(todos)
    setCarregando(false)

    // orçamento do mês atual (alimenta o sino); falhas aqui não atrapalham as contas
    carregarOrcamentoMes(supabase, mesParaISO(mesAtual())).then(setOrcamento).catch(() => {})
  }, [])

  // recarrega ao abrir o app e a cada troca de tela (marcações feitas em outras telas aparecem nos avisos)
  useEffect(() => {
    recarregar()
  }, [recarregar, local.pathname])

  // marca ou desfaz o pagamento de uma conta (fatura ou lançamento)
  const marcarPaga = useCallback(
    async (item, paga) => {
      const hoje = hojeISO()
      const { error } =
        item.origem === 'cartao'
          ? await supabase
              .from('faturas')
              .update({ status: paga ? 'paga' : 'aberta', pago_em: paga ? hoje : null })
              .eq('id', item.id)
          : await supabase
              .from('lancamentos')
              .update({ conta_paga: paga, conta_paga_em: paga ? hoje : null })
              .eq('id', item.id)
      await recarregar()
      return !error
    },
    [recarregar]
  )

  // categorias com limite que passaram dele ou estão a partir de 80%
  const alertasOrcamento = useMemo(
    () =>
      orcamento.linhas
        .filter((l) => l.limite > 0 && (l.estado.chave === 'atrasada' || l.estado.chave === 'breve'))
        .sort((a, b) => b.estado.pct - a.estado.pct),
    [orcamento]
  )

  // contas não pagas atrasadas ou que vencem em até DIAS_DE_AVISO dias
  const alertas = useMemo(
    () =>
      itens
        .filter((i) => !i.paga && i.est.dias !== null && i.est.dias <= DIAS_DE_AVISO)
        .sort((a, b) => a.est.dias - b.est.dias),
    [itens]
  )

  const valor = useMemo(
    () => ({ itens, alertas, alertasOrcamento, semVencimento, carregando, erro, recarregar, marcarPaga }),
    [itens, alertas, alertasOrcamento, semVencimento, carregando, erro, recarregar, marcarPaga]
  )

  return <AvisosContext.Provider value={valor}>{children}</AvisosContext.Provider>
}
