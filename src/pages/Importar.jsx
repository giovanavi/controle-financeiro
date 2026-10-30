import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Papa from 'papaparse'
import { CircleCheck } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import { centavosParaReais } from '../utils/dinheiro'
import { mesAtual, mesParaISO, rotuloMes } from '../utils/meses'
import { analisarLinhas, lerPlanilha, normalizar } from '../utils/importacao'
import '../importar.css'

export default function Importar() {
  const [pessoas, setPessoas] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [cartaoId, setCartaoId] = useState('')
  const [mes, setMes] = useState(mesAtual())
  const [categoriaId, setCategoriaId] = useState('')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [linhas, setLinhas] = useState([])
  const [erroArquivo, setErroArquivo] = useState('')

  const [existentes, setExistentes] = useState(0)
  const [confirmaExistentes, setConfirmaExistentes] = useState(false)
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [resultado, setResultado] = useState(null)

  async function carregarPessoas() {
    const { data, error } = await supabase.from('pessoas').select('*')
    if (error) setErro('Não foi possível carregar as pessoas.')
    else setPessoas(data)
  }

  useEffect(() => {
    async function carregar() {
      const [p, c, k] = await Promise.all([
        supabase.from('pessoas').select('*'),
        supabase.from('cartoes').select('*').eq('ativo', true).order('nome'),
        supabase.from('categorias').select('*').order('nome'),
      ])
      if (p.error || c.error || k.error) {
        setErro('Não foi possível carregar os cadastros.')
      } else {
        setPessoas(p.data)
        setCartoes(c.data)
        setCategorias(k.data)
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  // quantos lançamentos já existem na fatura escolhida (para evitar importar em duplicidade)
  useEffect(() => {
    if (!cartaoId) {
      setExistentes(0)
      return
    }
    let cancelado = false
    supabase
      .from('lancamentos')
      .select('id, faturas!inner(cartao_id, mes_referencia)', { count: 'exact', head: true })
      .eq('faturas.cartao_id', cartaoId)
      .eq('faturas.mes_referencia', mesParaISO(mes))
      .then(({ count, error }) => {
        if (cancelado) return
        setExistentes(error ? 0 : count ?? 0)
        setConfirmaExistentes(false)
      })
    return () => {
      cancelado = true
    }
  }, [cartaoId, mes])

  const analise = useMemo(() => analisarLinhas(linhas, pessoas), [linhas, pessoas])
  const temEu = pessoas.some((p) => p.eh_eu)
  const validas = analise.filter((l) => l.ok)
  const comProblema = analise.filter((l) => l.problemas.length > 0)

  const desconhecidas = useMemo(() => {
    const mapa = new Map()
    analise.forEach((l) => {
      if (l.nomeDesconhecido) mapa.set(normalizar(l.nomeDesconhecido), l.nomeDesconhecido)
    })
    return [...mapa.values()]
  }, [analise])

  const totalValidas = validas.reduce((a, l) => a + l.totalCent, 0)
  const minhaValidas = validas.reduce((a, l) => a + l.meuCent, 0)

  async function aoEscolherArquivo(evento) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    setResultado(null)
    setErro('')
    const texto = await arquivo.text()
    const { data } = Papa.parse(texto, { skipEmptyLines: true })
    const lido = lerPlanilha(data)
    setNomeArquivo(arquivo.name)
    setLinhas(lido.linhas)
    setErroArquivo(lido.erro)
  }

  async function cadastrarDesconhecidas() {
    setErro('')
    const { error } = await supabase.from('pessoas').insert(desconhecidas.map((nome) => ({ nome })))
    if (error) {
      setErro('Não foi possível cadastrar as pessoas.')
      return
    }
    await carregarPessoas()
  }

  async function importar() {
    setErro('')
    setImportando(true)
    setProgresso(0)
    const falhas = []

    for (let i = 0; i < validas.length; i++) {
      const l = validas[i]
      const { error } = await supabase.rpc('importar_parcelas', {
        p_descricao: l.descricao,
        p_cartao_id: cartaoId,
        p_mes_fatura: mesParaISO(mes),
        p_parcela_atual: l.atual,
        p_total_parcelas: l.totalParcelas,
        p_participacoes: l.participacoes,
        p_categoria_id: categoriaId || null,
        p_observacao: 'Importado da planilha',
      })
      if (error) {
        const motivo = error.code === 'P0001' ? error.message : 'erro ao gravar'
        falhas.push(`Linha ${l.numero} (${l.descricao}): ${motivo}`)
      }
      setProgresso(i + 1)
    }

    setImportando(false)
    setResultado({
      importadas: validas.length - falhas.length,
      ignoradas: analise.length - validas.length,
      falhas,
      cartaoId,
      mesISO: mesParaISO(mes),
    })
    setLinhas([])
    setNomeArquivo('')
  }

  if (carregando) return <p className="suave">Carregando…</p>

  const bloqueadoPorDuplicidade = existentes > 0 && !confirmaExistentes
  const podeImportar =
    !!cartaoId && temEu && validas.length > 0 && !importando && !bloqueadoPorDuplicidade

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Importar da planilha</h1>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {!temEu && (
        <div className="aviso aviso-acao">
          <span>Cadastre o seu perfil antes de importar.</span>
          <Link className="botao-secundario compacto" to="/pessoas">Ir para Pessoas</Link>
        </div>
      )}

      <div className="bloco formulario">
        <p className="dica">
          Exporte uma aba do cartão como CSV (Arquivo, Fazer download, Valores separados por
          vírgula). A importação traz a parcela do mês e as que ainda faltam; as parcelas já pagas
          em meses anteriores não são criadas.
        </p>

        <label className="campo">
          Cartão
          <select value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
            <option value="">Escolha…</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        <div>
          <div className="dica" style={{ marginBottom: 4 }}>Mês da fatura desta aba</div>
          <SeletorMes mes={mes} aoMudar={setMes} />
        </div>

        <label className="campo">
          Categoria para todas as compras (opcional)
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        <label className="campo">
          Arquivo CSV
          <input type="file" accept=".csv,text/csv" onChange={aoEscolherArquivo} />
        </label>
      </div>

      {erroArquivo && <p className="erro" role="alert">{erroArquivo}</p>}

      {resultado && (
        <div className="sucesso resultado-importacao" role="status">
          <div className="resultado-topo">
            <CircleCheck size={22} aria-hidden="true" />
            <div>
              <strong>{resultado.importadas} compra(s) importada(s)</strong>
              {resultado.ignoradas > 0 && (
                <div>{resultado.ignoradas} linha(s) ignorada(s) por problemas na prévia.</div>
              )}
            </div>
          </div>
          {resultado.falhas.length > 0 && (
            <ul>
              {resultado.falhas.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <div className="acoes">
            {resultado.cartaoId && (
              <Link
                className="botao-primario pequeno"
                to={`/cartoes/${resultado.cartaoId}?mes=${resultado.mesISO}`}
              >
                Ver fatura do cartão
              </Link>
            )}
            <button className="botao-secundario" onClick={() => setResultado(null)}>
              Importar outra aba
            </button>
          </div>
        </div>
      )}

      {analise.length > 0 && (
        <>
          {desconhecidas.length > 0 && (
            <div className="bloco">
              <p>
                Estas pessoas da coluna "quem" ainda não estão cadastradas:{' '}
                <b>{desconhecidas.join(', ')}</b>.
              </p>
              <button className="botao-primario pequeno" onClick={cadastrarDesconhecidas}>
                Cadastrar {desconhecidas.length === 1 ? 'esta pessoa' : 'estas pessoas'}
              </button>
            </div>
          )}

          <div className="bloco">
            <div className="cabecalho-secao">
              <b>Prévia de {nomeArquivo}</b>
              <span className="detalhe">Fatura de {rotuloMes(mes)}</span>
            </div>
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Descrição</th>
                    <th>Parcela</th>
                    <th className="num">Total</th>
                    <th className="num">Meu</th>
                    <th className="num">Outros</th>
                    <th>Quem</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.map((l) => (
                    <tr key={l.numero}>
                      <td>{l.numero}</td>
                      <td>{l.descricao}</td>
                      <td>{l.parcela || 'À vista'}</td>
                      <td className="num">{centavosParaReais(l.totalCent)}</td>
                      <td className="num">{centavosParaReais(l.meuCent)}</td>
                      <td className="num">{centavosParaReais(l.outrosCent)}</td>
                      <td>{l.nomeQuem || '—'}</td>
                      <td>
                        {l.problemas.length > 0 ? (
                          <span className="situacao-erro">{l.problemas.join('; ')}</span>
                        ) : l.nomeDesconhecido ? (
                          <span className="situacao-aviso">Pessoa não cadastrada</span>
                        ) : (
                          <span className="situacao-ok">
                            Pronta
                            {l.avisos.length > 0 && (
                              <span className="situacao-aviso"> · {l.avisos.join('; ')}</span>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="metricas">
            <div className="metrica">
              <div className="rotulo">Prontas para importar</div>
              <div className="numero">{validas.length} de {analise.length}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Soma das parcelas prontas</div>
              <div className="numero">{centavosParaReais(totalValidas)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Minha parte</div>
              <div className="numero">{centavosParaReais(minhaValidas)}</div>
            </div>
          </div>
          <p className="dica" style={{ marginBottom: 12 }}>
            Compare a soma com o total da sua planilha antes de importar. Linhas com problema
            ({comProblema.length}) não serão importadas.
          </p>

          {existentes > 0 && (
            <div className="aviso" style={{ marginBottom: 12 }}>
              <div>Esta fatura já tem {existentes} lançamento(s). Importar de novo pode duplicar compras.</div>
              <label className="check" style={{ marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={confirmaExistentes}
                  onChange={(e) => setConfirmaExistentes(e.target.checked)}
                />
                Importar mesmo assim
              </label>
            </div>
          )}

          <button
            className="botao-primario"
            style={{ width: '100%' }}
            disabled={!podeImportar}
            onClick={importar}
          >
            {importando
              ? `Importando… ${progresso} de ${validas.length}`
              : `Importar ${validas.length} compra(s)`}
          </button>
        </>
      )}
    </section>
  )
}
