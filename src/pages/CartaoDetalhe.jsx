import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useDialogo } from '../components/Dialogo'
import SeletorMes from '../components/SeletorMes'
import MenuAcoes from '../components/MenuAcoes'
import { centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { formatarData, hojeISO, mesAtual, mesDeISO, mesParaISO, rotuloMes } from '../utils/meses'
import { definirPago, salvarObservacaoPagamento } from '../utils/pagamento'
import '../faturas.css'

const TIPOS_ENCARGO = [
  ['juros', 'Juros'],
  ['multa', 'Multa'],
  ['iof', 'IOF'],
  ['anuidade', 'Anuidade'],
  ['outros', 'Outros'],
]
const ROTULO_ENCARGO = Object.fromEntries(TIPOS_ENCARGO)

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)
const rotuloParcela = (n, total) =>
  total > 1 ? ` · ${String(n).padStart(2, '0')}/${String(total).padStart(2, '0')}` : ''

export default function CartaoDetalhe() {
  const { id } = useParams()
  const { confirmar, perguntar } = useDialogo()
  const [mes, setMes] = useState(mesAtual())
  const [cartao, setCartao] = useState(null)
  const [fatura, setFatura] = useState(null) // null = não existe fatura neste mês
  const [lancs, setLancs] = useState([])
  const [encargos, setEncargos] = useState([])
  const [uso, setUso] = useState([])
  const [avisoLimite, setAvisoLimite] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [tipoEnc, setTipoEnc] = useState('juros')
  const [valorEnc, setValorEnc] = useState('')
  const [descEnc, setDescEnc] = useState('')

  const carregar = useCallback(async () => {
    const mesISO = mesParaISO(mes)
    const [c, f, u] = await Promise.all([
      supabase.from('cartoes').select('*').eq('id', id).single(),
      supabase.from('faturas').select('*').eq('cartao_id', id).eq('mes_referencia', mesISO).maybeSingle(),
      // tudo que está em faturas ainda abertas deste cartão (para o limite comprometido)
      supabase
        .from('lancamento_participacoes')
        .select('valor_centavos, pessoas(nome, eh_eu), lancamentos!inner(faturas!inner(cartao_id, status))')
        .eq('lancamentos.faturas.cartao_id', id)
        .eq('lancamentos.faturas.status', 'aberta'),
    ])

    if (c.error || f.error) {
      setErro('Não foi possível carregar este cartão.')
      setCarregando(false)
      return
    }
    setCartao(c.data)
    setFatura(f.data)
    setUso(u.error ? [] : u.data)
    setAvisoLimite(u.error ? 'Não foi possível calcular o limite comprometido.' : '')

    if (f.data) {
      const [l, e] = await Promise.all([
        supabase
          .from('lancamentos')
          .select(
            'id, numero_parcela, total_parcelas, valor_centavos, despesas(id, descricao, data), lancamento_participacoes(id, pessoa_id, valor_centavos, pago, pago_em, observacao, pessoas(nome, eh_eu))'
          )
          .eq('fatura_id', f.data.id)
          .order('criado_em'),
        supabase.from('fatura_encargos').select('*').eq('fatura_id', f.data.id).order('criado_em'),
      ])
      if (l.error || e.error) {
        setErro('Não foi possível carregar as compras da fatura.')
      } else {
        setLancs(l.data)
        setEncargos(e.data)
      }
    } else {
      setLancs([])
      setEncargos([])
    }
    setCarregando(false)
  }, [id, mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarPago(parte) {
    setErro('')
    const { error } = await definirPago(parte.id, !parte.pago)
    if (error) setErro('Não foi possível atualizar o pagamento.')
    await carregar()
  }

  async function editarObservacao(parte) {
    const texto = await perguntar({
      titulo: 'Observação do pagamento',
      mensagem: `${parte.pessoas?.nome} · ${centavosParaReais(parte.valor_centavos)}`,
      rotulo: 'Observação',
      placeholder: 'Ex.: pagou por Pix',
      valorInicial: parte.observacao ?? '',
      confirmar: 'Salvar observação',
    })
    if (texto === null) return
    setErro('')
    const { error } = await salvarObservacaoPagamento(parte.id, texto)
    if (error) setErro('Não foi possível salvar a observação.')
    await carregar()
  }

  async function alternarFatura() {
    const paga = fatura.status !== 'paga'
    setErro('')
    const { error } = await supabase
      .from('faturas')
      .update({ status: paga ? 'paga' : 'aberta', pago_em: paga ? hojeISO() : null })
      .eq('id', fatura.id)
    if (error) setErro('Não foi possível alterar o status da fatura.')
    await carregar()
  }

  async function excluirCompra(lanc) {
    const despesaId = lanc.despesas?.id
    if (!despesaId) return

    // confere tudo que será apagado antes de perguntar
    const { data: parcelas, error: erroBusca } = await supabase
      .from('lancamentos')
      .select('mes_referencia, valor_centavos, lancamento_participacoes(pago, pessoas(eh_eu))')
      .eq('despesa_id', despesaId)
      .order('mes_referencia')
    if (erroBusca || !parcelas || parcelas.length === 0) {
      setErro('Não foi possível conferir a compra antes de excluir.')
      return
    }

    const quantidade = parcelas.length
    const totalParcelas = soma(parcelas, (p) => p.valor_centavos)
    const primeira = mesDeISO(parcelas[0].mes_referencia)
    const ultima = mesDeISO(parcelas[quantidade - 1].mes_referencia)
    const comPagamento = parcelas.some((p) =>
      p.lancamento_participacoes.some((x) => x.pago && !x.pessoas?.eh_eu)
    )

    const detalhes = [['Compra', lanc.despesas.descricao]]
    if (quantidade > 1) {
      detalhes.push(['Parcelas', `${quantidade}, de ${rotuloMes(primeira)} a ${rotuloMes(ultima)}`])
    } else {
      detalhes.push(['Fatura', rotuloMes(primeira)])
    }
    detalhes.push(['Valor somado', centavosParaReais(totalParcelas)])

    const confirmou = await confirmar({
      titulo: 'Excluir esta compra?',
      mensagem:
        quantidade > 1
          ? 'Todas as parcelas serão removidas, inclusive as de outras faturas, junto com a divisão entre as pessoas. Não dá para desfazer.'
          : 'A compra e a divisão entre as pessoas serão removidas. Não dá para desfazer.',
      detalhes,
      aviso: comPagamento
        ? 'Há pagamentos de terceiros marcados nesta compra. Eles também serão perdidos.'
        : null,
      confirmar: quantidade > 1 ? `Excluir ${quantidade} parcelas` : 'Excluir compra',
      perigo: true,
    })
    if (!confirmou) return

    setErro('')
    const { error } = await supabase.from('despesas').delete().eq('id', despesaId)
    if (error) setErro('Não foi possível excluir a compra.')
    await carregar()
  }

  async function adicionarEncargo(evento) {
    evento.preventDefault()
    const valor = reaisParaCentavos(valorEnc)
    if (!valor || valor <= 0) return setErro('Informe o valor do encargo, por exemplo 25,90.')
    setErro('')
    const { error } = await supabase.from('fatura_encargos').insert({
      fatura_id: fatura.id,
      tipo: tipoEnc,
      valor_centavos: valor,
      descricao: descEnc.trim() || null,
    })
    if (error) return setErro('Não foi possível salvar o encargo.')
    setValorEnc('')
    setDescEnc('')
    await carregar()
  }

  async function excluirEncargo(encargo) {
    const confirmou = await confirmar({
      titulo: 'Excluir encargo?',
      mensagem: 'O encargo sai do total a pagar ao banco desta fatura.',
      detalhes: [
        ['Tipo', ROTULO_ENCARGO[encargo.tipo] ?? encargo.tipo],
        ['Valor', centavosParaReais(encargo.valor_centavos)],
      ],
      confirmar: 'Excluir encargo',
      perigo: true,
    })
    if (!confirmou) return
    setErro('')
    const { error } = await supabase.from('fatura_encargos').delete().eq('id', encargo.id)
    if (error) setErro('Não foi possível excluir o encargo.')
    await carregar()
  }

  if (carregando) return <p className="suave">Carregando…</p>
  if (!cartao) {
    return (
      <section>
        <Link className="voltar" to="/cartoes">
          <ArrowLeft size={16} aria-hidden="true" /> Cartões
        </Link>
        {erro && <p className="erro" role="alert">{erro}</p>}
      </section>
    )
  }

  // ----- cálculos -----
  const partes = lancs.flatMap((l) => l.lancamento_participacoes)
  const totalCompras = soma(lancs, (l) => l.valor_centavos)
  const minha = soma(partes.filter((p) => p.pessoas?.eh_eu), (p) => p.valor_centavos)
  const terceiros = totalCompras - minha
  const terceirosPagos = soma(partes.filter((p) => !p.pessoas?.eh_eu && p.pago), (p) => p.valor_centavos)
  const totalEncargos = soma(encargos, (e) => e.valor_centavos)

  const comprometido = soma(uso, (u) => u.valor_centavos)
  const percentual = cartao.limite_centavos > 0 ? Math.round((comprometido / cartao.limite_centavos) * 100) : 0
  const porPessoa = {}
  uso.forEach((u) => {
    const nome = u.pessoas?.nome ?? 'Sem pessoa'
    porPessoa[nome] = (porPessoa[nome] ?? 0) + u.valor_centavos
  })
  const ranking = Object.entries(porPessoa).sort((a, b) => b[1] - a[1])

  return (
    <section>
      <Link className="voltar" to="/cartoes">
        <ArrowLeft size={16} aria-hidden="true" /> Cartões
      </Link>
      <div className="cabecalho-pagina">
        <h1>{cartao.nome}</h1>
        <span className="detalhe">
          Fecha dia {cartao.dia_fechamento} · vence dia {cartao.dia_vencimento}
        </span>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="bloco">
        <div className="cabecalho-secao">
          <b>Limite comprometido</b>
          <span className="detalhe">
            {centavosParaReais(comprometido)} de {centavosParaReais(cartao.limite_centavos)} ({percentual}%)
          </span>
        </div>
        <div className={percentual >= 80 ? 'barra alta' : 'barra'}>
          <span style={{ width: `${Math.min(percentual, 100)}%` }} />
        </div>
        <p className="dica">Soma das faturas ainda abertas, incluindo as parcelas futuras.</p>
        {avisoLimite && <p className="aviso">{avisoLimite}</p>}
        {ranking.length > 0 && (
          <ul className="lista" style={{ marginTop: 8 }}>
            {ranking.map(([nome, valor]) => (
              <li key={nome} className="linha">
                <span>{nome}</span>
                <span>{centavosParaReais(valor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SeletorMes mes={mes} aoMudar={setMes} />

      {!fatura ? (
        <div className="bloco">
          <p className="suave" style={{ margin: 0 }}>Nenhuma compra nesta fatura.</p>
        </div>
      ) : (
        <>
          <div className="cabecalho-secao">
            <span className={fatura.status === 'paga' ? 'chip' : 'chip inativo'} style={{ marginLeft: 0 }}>
              Fatura {fatura.status === 'paga' ? `paga em ${formatarData(fatura.pago_em)}` : 'aberta'}
            </span>
            <button className="botao-secundario" onClick={alternarFatura}>
              {fatura.status === 'paga' ? 'Reabrir fatura' : 'Marcar fatura como paga'}
            </button>
          </div>

          <div className="metricas">
            <div className="metrica">
              <div className="rotulo">Total a pagar ao banco</div>
              <div className="numero">{centavosParaReais(totalCompras + totalEncargos)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Minha parte</div>
              <div className="numero">{centavosParaReais(minha)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">De terceiros</div>
              <div className="numero">{centavosParaReais(terceiros)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Já pagaram</div>
              <div className="numero">{centavosParaReais(terceirosPagos)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Pendente</div>
              <div className="numero">{centavosParaReais(terceiros - terceirosPagos)}</div>
            </div>
          </div>

          <div className="bloco">
            <b>Compras</b>
            <ul className="lista">
              {lancs.map((l) => (
                <li key={l.id} className="item-lanc">
                  <div className="topo">
                    <div>
                      <div className="titulo">
                        {l.despesas?.descricao}
                        {rotuloParcela(l.numero_parcela, l.total_parcelas)}
                      </div>
                      <div className="detalhe">Compra em {formatarData(l.despesas?.data)}</div>
                    </div>
                    <div className="valor-com-menu">
                      <span className="titulo">{centavosParaReais(l.valor_centavos)}</span>
                      <MenuAcoes
                        itens={[
                          { rotulo: 'Editar compra', Icone: Pencil, para: `/lancar?editar=${l.despesas?.id}` },
                          { rotulo: 'Excluir compra', Icone: Trash2, perigo: true, aoClicar: () => excluirCompra(l) },
                        ]}
                      />
                    </div>
                  </div>
                  <ul className="sub-lista">
                    {l.lancamento_participacoes.map((p) => (
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
                        <button className="link-btn" onClick={() => editarObservacao(p)}>
                          {p.observacao ? 'editar obs.' : 'obs.'}
                        </button>
                        {p.observacao && <span className="obs">{p.observacao}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          <div className="bloco">
            <b>Encargos da fatura</b>
            {encargos.length > 0 && (
              <ul className="lista">
                {encargos.map((e) => (
                  <li key={e.id} className="linha">
                    <div>
                      <div className="titulo">{ROTULO_ENCARGO[e.tipo] ?? e.tipo}</div>
                      {e.descricao && <div className="detalhe">{e.descricao}</div>}
                    </div>
                    <div className="valor-com-menu">
                      <span>{centavosParaReais(e.valor_centavos)}</span>
                      <MenuAcoes
                        itens={[
                          { rotulo: 'Excluir encargo', Icone: Trash2, perigo: true, aoClicar: () => excluirEncargo(e) },
                        ]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form className="formulario" onSubmit={adicionarEncargo} style={{ marginTop: 12 }}>
              <div className="duas-colunas">
                <label className="campo">
                  Tipo
                  <select value={tipoEnc} onChange={(e) => setTipoEnc(e.target.value)}>
                    {TIPOS_ENCARGO.map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  Valor (R$)
                  <input
                    value={valorEnc}
                    onChange={(e) => setValorEnc(e.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </label>
              </div>
              <label className="campo">
                Descrição (opcional)
                <input value={descEnc} onChange={(e) => setDescEnc(e.target.value)} />
              </label>
              <div className="acoes">
                <button className="botao-primario pequeno" type="submit">Adicionar encargo</button>
              </div>
            </form>
            <p className="dica" style={{ marginTop: 8 }}>
              Os encargos entram no total a pagar ao banco, mas não são divididos entre as pessoas.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
