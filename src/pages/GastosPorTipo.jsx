import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, CircleCheck, Pencil, Repeat, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import MenuAcoes from '../components/MenuAcoes'
import EstadoVazio from '../components/EstadoVazio'
import { useDialogo } from '../components/Dialogo'
import { estadoConta } from '../utils/vencimentos'
import SeletorMes from '../components/SeletorMes'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { formatarData, hojeISO, mesAtual, mesDeISO, mesParaISO, rotuloMes } from '../utils/meses'
import { definirPago } from '../utils/pagamento'
import '../faturas.css'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

// Usada para "Gastos fixos" (tipo="fixo") e "Extras" (tipo="extra")
export default function GastosPorTipo({ tipo, titulo }) {
  const { confirmar, perguntar } = useDialogo()
  const [params] = useSearchParams()
  const mesDoLink = params.get('mes') // ex.: /fixos?mes=2026-11-01 (vindo de Contas a pagar)
  const [mes, setMes] = useState(
    mesDoLink && /^\d{4}-\d{2}-01$/.test(mesDoLink) ? mesDeISO(mesDoLink) : mesAtual()
  )
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('lancamentos')
      .select(
        'id, valor_centavos, vencimento, conta_paga, conta_paga_em, valor_estimado, despesas!inner(id, descricao, tipo, recorrente, dia_vencimento), lancamento_participacoes(id, valor_centavos, pago, pessoas(nome, eh_eu))'
      )
      .eq('mes_referencia', mesParaISO(mes))
      .eq('despesas.tipo', tipo)

    if (error) {
      setErro('Não foi possível carregar os lançamentos.')
    } else {
      setErro('')
      setItens([...data].sort((a, b) => a.despesas.descricao.localeCompare(b.despesas.descricao)))
    }
    setCarregando(false)
  }, [mes, tipo])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarPago(parte) {
    setErro('')
    const { error } = await definirPago(parte.id, !parte.pago)
    if (error) setErro('Não foi possível atualizar o pagamento.')
    await carregar()
  }

  async function ajustarValor(item) {
    const texto = await perguntar({
      titulo: 'Ajustar valor deste mês',
      mensagem: `${item.despesas.descricao} em ${rotuloMes(mes)}. A divisão entre as pessoas mantém a mesma proporção, e os outros meses não mudam.`,
      rotulo: 'Novo valor total (R$)',
      valorInicial: centavosParaCampo(item.valor_centavos),
      inputMode: 'decimal',
      confirmar: 'Ajustar valor',
    })
    if (texto === null) return
    const novo = reaisParaCentavos(texto)
    if (!novo || novo <= 0) return setErro('Informe um valor maior que zero, por exemplo 310,00.')
    setErro('')
    const { error } = await supabase.rpc('ajustar_valor_lancamento', {
      p_lancamento_id: item.id,
      p_novo_total_centavos: novo,
    })
    if (error) {
      setErro(error.code === 'P0001' ? error.message : 'Não foi possível ajustar o valor.')
      return
    }
    await supabase.from('lancamentos').update({ valor_estimado: false }).eq('id', item.id)
    await carregar()
  }

  async function alternarContaPaga(item) {
    setErro('')
    const paga = !item.conta_paga
    const { error } = await supabase
      .from('lancamentos')
      .update({ conta_paga: paga, conta_paga_em: paga ? hojeISO() : null })
      .eq('id', item.id)
    if (error) setErro('Não foi possível atualizar o pagamento da conta.')
    await carregar()
  }

  async function definirVencimento(item) {
    const recorrente = item.despesas.recorrente
    const atual = recorrente
      ? item.despesas.dia_vencimento
        ? String(item.despesas.dia_vencimento)
        : ''
      : item.vencimento
        ? formatarData(item.vencimento)
        : ''
    const texto = await perguntar({
      titulo: 'Definir vencimento',
      mensagem: recorrente
        ? `${item.despesas.descricao}: informe o dia do mês em que a conta vence. Vale para todos os meses ainda não pagos.`
        : `${item.despesas.descricao}: informe a data de vencimento.`,
      rotulo: recorrente ? 'Dia do vencimento (1 a 31)' : 'Data de vencimento (dd/mm/aaaa)',
      placeholder: recorrente ? '10' : '15/11/2026',
      valorInicial: atual,
      inputMode: 'numeric',
      confirmar: 'Salvar vencimento',
    })
    if (texto === null) return

    let argumentos
    if (recorrente) {
      const dia = Number(texto.trim())
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) return setErro('Informe um dia de 1 a 31.')
      argumentos = { p_dia: dia }
    } else {
      const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null
      const existe =
        d && d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1])
      if (!existe) return setErro('Informe uma data válida no formato dd/mm/aaaa.')
      argumentos = { p_vencimento: `${m[3]}-${m[2]}-${m[1]}` }
    }

    setErro('')
    const { error } = await supabase.rpc('definir_vencimento_despesa', {
      p_despesa_id: item.despesas.id,
      ...argumentos,
    })
    if (error) {
      setErro(error.code === 'P0001' ? error.message : 'Não foi possível salvar o vencimento.')
      return
    }
    await carregar()
  }

  async function excluir(item) {
    const recorrente = item.despesas.recorrente
    const confirmou = await confirmar({
      titulo: recorrente ? `Excluir só em ${rotuloMes(mes)}?` : 'Excluir este lançamento?',
      mensagem: recorrente
        ? 'Apenas este mês será removido. Os outros meses deste gasto fixo continuam.'
        : 'O lançamento e a divisão entre as pessoas serão removidos. Não dá para desfazer.',
      detalhes: [
        ['Lançamento', item.despesas.descricao],
        ['Valor', centavosParaReais(item.valor_centavos)],
        ['Mês', rotuloMes(mes)],
      ],
      confirmar: recorrente ? 'Excluir este mês' : 'Excluir',
      perigo: true,
    })
    if (!confirmou) return
    setErro('')
    // gasto não recorrente: apaga a despesa inteira; recorrente: apaga só a ocorrência do mês
    const { error } = recorrente
      ? await supabase.from('lancamentos').delete().eq('id', item.id)
      : await supabase.from('despesas').delete().eq('id', item.despesas.id)
    if (error) setErro('Não foi possível excluir.')
    await carregar()
  }

  if (carregando) return <p className="suave">Carregando…</p>

  const meuTotal = soma(itens, (i) =>
    soma(i.lancamento_participacoes.filter((p) => p.pessoas?.eh_eu), (p) => p.valor_centavos)
  )

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>{titulo}</h1>
        <Link className="botao-primario pequeno" to={`/lancar?tipo=${tipo}`} style={{ textDecoration: 'none' }}>
          {tipo === 'fixo' ? 'Novo gasto fixo' : 'Novo extra'}
        </Link>
      </div>

      <SeletorMes mes={mes} aoMudar={setMes} />

      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="metrica" style={{ marginBottom: 16 }}>
        <div className="rotulo">Minha parte no mês</div>
        <div className="numero">{centavosParaReais(meuTotal)}</div>
      </div>

      <div className="bloco">
        {itens.length === 0 ? (
          <EstadoVazio
            simples
            Icone={tipo === 'fixo' ? Repeat : Sparkles}
            titulo={tipo === 'fixo' ? 'Nenhum gasto fixo neste mês' : 'Nenhum extra neste mês'}
            texto={
              tipo === 'fixo'
                ? 'Cadastre contas como aluguel, internet e energia. Elas se repetem sozinhas todo mês.'
                : 'Lance gastos avulsos que não fazem parte das faturas nem das contas fixas.'
            }
          >
            <Link className="botao-primario pequeno" to={`/lancar?tipo=${tipo}`}>
              {tipo === 'fixo' ? 'Novo gasto fixo' : 'Novo extra'}
            </Link>
          </EstadoVazio>
        ) : (
          <ul className="lista">
            {itens.map((item) => {
              const partes = item.lancamento_participacoes
              const minha = soma(partes.filter((p) => p.pessoas?.eh_eu), (p) => p.valor_centavos)
              const dividida = partes.length > 1 || !partes[0]?.pessoas?.eh_eu
              const est = estadoConta({
                venc: item.vencimento,
                paga: item.conta_paga,
                pagaEm: item.conta_paga_em,
              })
              return (
                <li key={item.id} className="item-lanc">
                  <div className="topo">
                    <div>
                      <div className="titulo">
                        {item.despesas.descricao}
                        {item.despesas.recorrente && <span className="chip">Recorrente</span>}
                      </div>
                      {dividida && (
                        <div className="detalhe">Total {centavosParaReais(item.valor_centavos)}</div>
                      )}
                      {item.vencimento || item.conta_paga ? (
                        <div className="detalhe">
                          {item.vencimento && `Vence ${formatarData(item.vencimento)} · `}
                          <span className={`estado estado-${est.chave}`}>{est.texto}</span>
                          {item.valor_estimado && !item.conta_paga && ' · valor estimado'}
                        </div>
                      ) : (
                        <div className="detalhe">Sem vencimento definido</div>
                      )}
                    </div>
                    <div className="valor-com-menu">
                      <span className="titulo">{centavosParaReais(minha)}</span>
                      <MenuAcoes
                        itens={[
                          { rotulo: 'Editar', Icone: Pencil, para: `/lancar?editar=${item.despesas.id}` },
                          {
                            rotulo: item.conta_paga ? 'Desfazer pagamento' : 'Marcar como paga',
                            Icone: CircleCheck,
                            aoClicar: () => alternarContaPaga(item),
                          },
                          { rotulo: 'Definir vencimento', Icone: CalendarClock, aoClicar: () => definirVencimento(item) },
                          { rotulo: 'Ajustar valor do mês', Icone: SlidersHorizontal, aoClicar: () => ajustarValor(item) },
                          {
                            rotulo: item.despesas.recorrente ? 'Excluir só este mês' : 'Excluir',
                            Icone: Trash2,
                            perigo: true,
                            aoClicar: () => excluir(item),
                          },
                        ]}
                      />
                    </div>
                  </div>

                  {dividida && (
                    <ul className="sub-lista">
                      {partes.map((p) => (
                        <li key={p.id} className="sub">
                          <span>
                            {p.pessoas?.nome}
                            {p.pessoas?.eh_eu && <span className="chip">Você</span>}
                          </span>
                          <span className="valor">{centavosParaReais(p.valor_centavos)}</span>
                          {!p.pessoas?.eh_eu && (
                            <button
                              className={p.pago ? 'chip-btn pago' : 'chip-btn pend'}
                              aria-pressed={p.pago}
                              onClick={() => alternarPago(p)}
                            >
                              {p.pago ? 'Pago' : 'Pendente'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
