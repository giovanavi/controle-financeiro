import Esqueleto from '../components/Esqueleto'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import BannerContas from '../components/BannerContas'
import CartaoSaldo from '../components/CartaoSaldo'
import CartaoOrcamento from '../components/CartaoOrcamento'
import EstadoVazio from '../components/EstadoVazio'
import { carregarOrcamentoMes } from '../utils/orcamento'
import { centavosParaReais } from '../utils/dinheiro'
import { mesAtual, mesParaISO, rotuloMes } from '../utils/meses'
import { lerPreferencia, salvarPreferencia } from '../utils/preferencias'
import '../faturas.css'
import '../resumo.css'
import '../resumo2.css'

function acumular(mapa, chave, rotulo, valor, minha, id = null) {
  const atual = mapa.get(chave) ?? { rotulo, id, total: 0, meu: 0 }
  atual.total += valor
  if (minha) atual.meu += valor
  mapa.set(chave, atual)
}

const lista = (mapa) => [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo))
const somar = (itens, campo) => itens.reduce((total, item) => total + item[campo], 0)

// Seção que se recolhe: o cabeçalho mostra o total mesmo fechada
function Secao({ id, titulo, resumo, aberta, aoAlternar, children }) {
  return (
    <div className="bloco secao-resumo">
      <button
        type="button"
        className="secao-cabecalho"
        aria-expanded={aberta}
        onClick={() => aoAlternar(id)}
      >
        <b>{titulo}</b>
        <span className="secao-valor">{resumo}</span>
        <ChevronDown size={18} className={aberta ? 'seta girada' : 'seta'} aria-hidden="true" />
      </button>
      {aberta && <div className="secao-corpo">{children}</div>}
    </div>
  )
}

export default function Resumo() {
  const [mes, setMes] = useState(mesAtual())
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  // preferências lembradas neste aparelho
  const [modo, setModo] = useState(() => lerPreferencia('resumo.modo', 'essencial'))
  const [abertas, setAbertas] = useState(() =>
    lerPreferencia('resumo.secoes', { numeros: true, fixos: true, cartoes: true, extras: true })
  )

  function mudarModo(novo) {
    setModo(novo)
    salvarPreferencia('resumo.modo', novo)
  }

  function alternarSecao(id) {
    const novas = { ...abertas, [id]: !abertas[id] }
    setAbertas(novas)
    salvarPreferencia('resumo.secoes', novas)
  }

  const carregar = useCallback(async () => {
    const mesISO = mesParaISO(mes)
    const [p, e, f, rc, orc] = await Promise.all([
      supabase
        .from('lancamento_participacoes')
        .select(
          'valor_centavos, pago, pessoas(eh_eu), lancamentos!inner(id, mes_referencia, despesas(descricao, tipo, cartao_id, cartoes(nome)))'
        )
        .eq('lancamentos.mes_referencia', mesISO),
      supabase
        .from('fatura_encargos')
        .select('valor_centavos, faturas!inner(mes_referencia)')
        .eq('faturas.mes_referencia', mesISO),
      supabase
        .from('lancamentos')
        .select('valor_centavos, despesas!inner(tipo)')
        .eq('despesas.tipo', 'cartao')
        .gt('mes_referencia', mesISO),
      supabase.from('receitas').select('valor_centavos, recebida').eq('mes_referencia', mesISO),
      carregarOrcamentoMes(supabase, mesISO),
    ])

    if (p.error || e.error || f.error) {
      setErro('Não foi possível carregar o resumo.')
      setCarregando(false)
      return
    }
    setErro('')

    const fixos = new Map()
    const extras = new Map()
    const cartoes = new Map()
    let pendenteTerceiros = 0
    let pagoTerceiros = 0

    for (const x of p.data) {
      const lanc = x.lancamentos
      const desp = lanc.despesas
      const minha = !!x.pessoas?.eh_eu
      if (!minha && !x.pago) pendenteTerceiros += x.valor_centavos
      if (!minha && x.pago) pagoTerceiros += x.valor_centavos

      if (desp.tipo === 'fixo') {
        acumular(fixos, lanc.id, desp.descricao, x.valor_centavos, minha, lanc.id)
      } else if (desp.tipo === 'extra') {
        acumular(extras, lanc.id, desp.descricao, x.valor_centavos, minha, lanc.id)
      } else {
        acumular(cartoes, desp.cartao_id, desp.cartoes?.nome ?? 'Cartão', x.valor_centavos, minha, desp.cartao_id)
      }
    }

    setDados({
      fixos: lista(fixos),
      extras: lista(extras),
      cartoes: lista(cartoes),
      pendenteTerceiros,
      pagoTerceiros,
      receitasDisponiveis: !rc.error,
      orcamento: orc,
      receitaPrevista: rc.error ? 0 : somar(rc.data, 'valor_centavos'),
      receitaRecebida: rc.error ? 0 : somar(rc.data.filter((r) => r.recebida), 'valor_centavos'),
      encargos: somar(e.data, 'valor_centavos'),
      parcelado: somar(f.data, 'valor_centavos'),
    })
    setCarregando(false)
  }, [mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (carregando) return <Esqueleto />

  const mesISO = mesParaISO(mes)
  const meuFixos = dados ? somar(dados.fixos, 'meu') : 0
  const meuCartoes = dados ? somar(dados.cartoes, 'meu') : 0
  const meuExtras = dados ? somar(dados.extras, 'meu') : 0
  const totalCartoes = dados ? somar(dados.cartoes, 'total') : 0
  const gastoReal = meuFixos + meuCartoes + meuExtras
  const totalFixos = dados ? somar(dados.fixos, 'total') : 0
  const totalExtras = dados ? somar(dados.extras, 'total') : 0
  const vazio = dados && !dados.fixos.length && !dados.extras.length && !dados.cartoes.length
  const atual = mesAtual()
  const ehMesAtual = atual.ano === mes.ano && atual.mes === mes.mes

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Resumo</h1>
        <div className="segmentos pequeno" role="group" aria-label="Nível de detalhe">
          <button className={modo === 'essencial' ? 'ativo' : ''} onClick={() => mudarModo('essencial')}>
            Essencial
          </button>
          <button className={modo === 'completo' ? 'ativo' : ''} onClick={() => mudarModo('completo')}>
            Completo
          </button>
        </div>
      </div>

      {/* 1. avisos de contas */}
      <BannerContas para="/contas" />

      <SeletorMes mes={mes} aoMudar={setMes} />

      {erro && <p className="erro" role="alert">{erro}</p>}

      {dados && (
        <>
          {/* 2. o número principal e o saldo */}
          <div className="hero">
            <div className="rotulo">Gasto real do mês</div>
            <div className="grande">{centavosParaReais(gastoReal)}</div>
            <div className="rotulo">Gastos fixos + minha parte nas faturas + extras</div>
          </div>

          <CartaoSaldo
            mesISO={mesISO}
            receitaPrevista={dados.receitaPrevista}
            receitaRecebida={dados.receitaRecebida}
            receitasDisponiveis={dados.receitasDisponiveis}
            gastoReal={gastoReal}
            encargos={dados.encargos}
            saidas={{ fixos: totalFixos, faturas: totalCartoes, extras: totalExtras, encargos: dados.encargos }}
            reembolsoRecebido={dados.pagoTerceiros}
            reembolsoPendente={dados.pendenteTerceiros}
          />

          {/* 3. orçamento */}
          <CartaoOrcamento orcamento={dados.orcamento} mesISO={mesISO} />

          {vazio ? (
            <>
              <EstadoVazio
                Icone={CalendarDays}
                titulo={`Nada lançado em ${rotuloMes(mes)}`}
                texto="Lance uma despesa, importe a fatura de um cartão ou cadastre seus gastos fixos para ver o resumo deste mês."
              >
                <Link className="botao-primario" to="/lancar">
                  <Plus size={18} aria-hidden="true" /> Lançar despesa
                </Link>
                <Link className="botao-secundario" to="/lancar?tipo=fixo">Novo gasto fixo</Link>
                <Link className="botao-secundario" to="/importar">Importar da planilha</Link>
                {!ehMesAtual && (
                  <button className="botao-secundario" onClick={() => setMes(mesAtual())}>
                    Voltar para o mês atual
                  </button>
                )}
              </EstadoVazio>
              {dados.parcelado > 0 && (
                <p className="dica" style={{ marginBottom: 16, textAlign: 'center' }}>
                  Há {centavosParaReais(dados.parcelado)} em parcelas nos meses seguintes.
                </p>
              )}
            </>
          ) : modo === 'essencial' ? (
            /* 4a. modo essencial: uma lista curta, cada linha leva à tela de detalhe */
            <div className="bloco">
              <div className="cabecalho-secao">
                <b>Para onde foi o dinheiro</b>
              </div>
              <ul className="lista">
                <li className="linha">
                  <Link className="item-link" to={`/fixos?mes=${mesISO}`}>
                    <div className="item-texto"><div className="titulo">Gastos fixos</div></div>
                    <span>{centavosParaReais(meuFixos)}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
                <li className="linha">
                  <Link className="item-link" to="/cartoes">
                    <div className="item-texto">
                      <div className="titulo">Faturas dos cartões</div>
                      <div className="detalhe">minha parte</div>
                    </div>
                    <span>{centavosParaReais(meuCartoes)}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
                <li className="linha">
                  <Link className="item-link" to={`/extras?mes=${mesISO}`}>
                    <div className="item-texto"><div className="titulo">Extras</div></div>
                    <span>{centavosParaReais(meuExtras)}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Link>
                </li>
                {dados.pendenteTerceiros > 0 && (
                  <li className="linha">
                    <Link className="item-link" to="/pessoas">
                      <div className="item-texto">
                        <div className="titulo">Terceiros ainda me devem</div>
                        <div className="detalhe">neste mês</div>
                      </div>
                      <span>{centavosParaReais(dados.pendenteTerceiros)}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            /* 4b. modo completo: números do mês e listas, cada seção se recolhe */
            <>
              <Secao
                id="numeros"
                titulo="Números do mês"
                resumo={`${centavosParaReais(totalCartoes + dados.encargos)} no cartão`}
                aberta={abertas.numeros}
                aoAlternar={alternarSecao}
              >
                <div className="metricas">
                  <div className="metrica">
                    <div className="rotulo">Vou pagar de cartão</div>
                    <div className="numero">{centavosParaReais(totalCartoes + dados.encargos)}</div>
                  </div>
                  <div className="metrica">
                    <div className="rotulo">Terceiros ainda me devem</div>
                    <div className="numero">{centavosParaReais(dados.pendenteTerceiros)}</div>
                  </div>
                  <div className="metrica">
                    <div className="rotulo">Encargos (juros e taxas)</div>
                    <div className="numero">{centavosParaReais(dados.encargos)}</div>
                  </div>
                  <div className="metrica">
                    <div className="rotulo">Parcelado nos meses seguintes</div>
                    <div className="numero">{centavosParaReais(dados.parcelado)}</div>
                  </div>
                </div>
              </Secao>

              <Secao
                id="fixos"
                titulo="Gastos fixos"
                resumo={centavosParaReais(meuFixos)}
                aberta={abertas.fixos}
                aoAlternar={alternarSecao}
              >
                {dados.fixos.length === 0 ? (
                  <p className="suave" style={{ margin: 0 }}>Nenhum gasto fixo neste mês.</p>
                ) : (
                  <ul className="lista">
                    {dados.fixos.map((i) => (
                      <li key={i.id} className="linha">
                        <span>{i.rotulo}</span>
                        <span>{centavosParaReais(i.meu)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link className="link-acao" to={`/fixos?mes=${mesISO}`}>
                  Ver todos <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </Secao>

              <Secao
                id="cartoes"
                titulo="Faturas dos cartões"
                resumo={`${centavosParaReais(meuCartoes)} minha parte`}
                aberta={abertas.cartoes}
                aoAlternar={alternarSecao}
              >
                {dados.cartoes.length === 0 ? (
                  <p className="suave" style={{ margin: 0 }}>Nenhuma fatura neste mês.</p>
                ) : (
                  <ul className="lista">
                    {dados.cartoes.map((c) => (
                      <li key={c.id} className="linha">
                        <Link className="item-link" to={`/cartoes/${c.id}?mes=${mesISO}`}>
                          <div className="item-texto">
                            <div className="titulo">{c.rotulo}</div>
                            <div className="detalhe">Fatura {centavosParaReais(c.total)}</div>
                          </div>
                          <span>{centavosParaReais(c.meu)}</span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link className="link-acao" to="/cartoes">
                  Ver cartões <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </Secao>

              <Secao
                id="extras"
                titulo="Extras"
                resumo={centavosParaReais(meuExtras)}
                aberta={abertas.extras}
                aoAlternar={alternarSecao}
              >
                {dados.extras.length === 0 ? (
                  <p className="suave" style={{ margin: 0 }}>Nenhum extra neste mês.</p>
                ) : (
                  <ul className="lista">
                    {dados.extras.map((i) => (
                      <li key={i.id} className="linha">
                        <span>{i.rotulo}</span>
                        <span>{centavosParaReais(i.meu)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link className="link-acao" to={`/extras?mes=${mesISO}`}>
                  Ver todos <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </Secao>
            </>
          )}

          {/* atalhos para as outras áreas do dinheiro */}
          <div className="atalhos">
            <Link className="botao-secundario compacto" to="/receitas">Receitas</Link>
            <Link className="botao-secundario compacto" to="/orcamento">Orçamento</Link>
            <Link className="botao-secundario compacto" to="/analises">Análises</Link>
          </div>
        </>
      )}
    </section>
  )
}
