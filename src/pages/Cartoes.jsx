import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, Pencil, Power } from 'lucide-react'
import { supabase } from '../supabaseClient'
import MenuAcoes from '../components/MenuAcoes'
import EstadoVazio from '../components/EstadoVazio'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'

const diaValido = (texto) => {
  const n = Number(texto)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null
}

export default function Cartoes() {
  const [cartoes, setCartoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const { data, error } = await supabase.from('cartoes').select('*').order('nome')
    if (error) setErro('Não foi possível carregar os cartões.')
    else setCartoes(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(evento) {
    evento.preventDefault()
    const nome = form.nome.trim()
    const limite = reaisParaCentavos(form.limite)
    const fechamento = diaValido(form.fechamento)
    const vencimento = diaValido(form.vencimento)

    if (!nome) return setErro('Informe o nome do cartão.')
    if (limite === null) return setErro('Informe o limite em reais, por exemplo 1500,00.')
    if (!fechamento) return setErro('O dia de fechamento deve ser um número de 1 a 31.')
    if (!vencimento) return setErro('O dia de vencimento deve ser um número de 1 a 31.')

    setErro('')
    setSalvando(true)
    const dados = {
      nome,
      instituicao: form.instituicao.trim() || null,
      limite_centavos: limite,
      dia_fechamento: fechamento,
      dia_vencimento: vencimento,
    }
    const { error } = form.id
      ? await supabase.from('cartoes').update(dados).eq('id', form.id)
      : await supabase.from('cartoes').insert(dados)
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Tente de novo.')
    setForm(null)
    await carregar()
  }

  async function alternarAtivo(cartao) {
    setErro('')
    const { error } = await supabase
      .from('cartoes')
      .update({ ativo: !cartao.ativo })
      .eq('id', cartao.id)
    if (error) setErro('Não foi possível alterar o status.')
    await carregar()
  }

  function editar(c) {
    setErro('')
    setForm({
      id: c.id,
      nome: c.nome,
      instituicao: c.instituicao ?? '',
      limite: centavosParaCampo(c.limite_centavos),
      fechamento: String(c.dia_fechamento),
      vencimento: String(c.dia_vencimento),
    })
  }

  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Cartões</h1>
        {!form && (
          <button
            className="botao-primario pequeno"
            onClick={() => {
              setErro('')
              setForm({ id: null, nome: '', instituicao: '', limite: '', fechamento: '', vencimento: '' })
            }}
          >
            Novo cartão
          </button>
        )}
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {form && (
        <form className="bloco formulario" onSubmit={salvar}>
          <label className="campo">
            Nome
            <input value={form.nome} onChange={mudar('nome')} placeholder="Nubank" autoFocus />
          </label>
          <label className="campo">
            Instituição (opcional)
            <input value={form.instituicao} onChange={mudar('instituicao')} placeholder="Nu Pagamentos" />
          </label>
          <label className="campo">
            Limite (R$)
            <input value={form.limite} onChange={mudar('limite')} inputMode="decimal" placeholder="1500,00" />
          </label>
          <div className="duas-colunas">
            <label className="campo">
              Dia de fechamento
              <input value={form.fechamento} onChange={mudar('fechamento')} inputMode="numeric" placeholder="5" />
            </label>
            <label className="campo">
              Dia de vencimento
              <input value={form.vencimento} onChange={mudar('vencimento')} inputMode="numeric" placeholder="12" />
            </label>
          </div>
          <div className="acoes">
            <button className="botao-primario pequeno" type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button type="button" className="botao-secundario" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bloco">
        {carregando ? (
          <p className="suave">Carregando…</p>
        ) : cartoes.length === 0 ? (
          <EstadoVazio
            simples
            Icone={CreditCard}
            titulo="Nenhum cartão cadastrado"
            texto="Cadastre seus cartões para lançar compras e acompanhar faturas e limites."
          >
            <button
              className="botao-primario pequeno"
              onClick={() => {
                setErro('')
                setForm({ id: null, nome: '', instituicao: '', limite: '', fechamento: '', vencimento: '' })
              }}
            >
              Cadastrar cartão
            </button>
          </EstadoVazio>
        ) : (
          <ul className="lista">
            {cartoes.map((c) => (
              <li key={c.id} className={c.ativo ? 'linha' : 'linha desativada'}>
                <Link className="item-link" to={`/cartoes/${c.id}`}>
                  <div className="item-texto">
                    <div className="titulo">
                      {c.nome}
                      {!c.ativo && <span className="chip inativo">Inativo</span>}
                    </div>
                    <div className="detalhe">Limite {centavosParaReais(c.limite_centavos)}</div>
                    <div className="detalhe">
                      Fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}
                      {c.instituicao ? ` · ${c.instituicao}` : ''}
                    </div>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
                <MenuAcoes
                  itens={[
                    { rotulo: 'Editar', Icone: Pencil, aoClicar: () => editar(c) },
                    {
                      rotulo: c.ativo ? 'Desativar' : 'Ativar',
                      Icone: Power,
                      aoClicar: () => alternarAtivo(c),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
