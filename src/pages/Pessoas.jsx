import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, Power, Users } from 'lucide-react'
import { supabase } from '../supabaseClient'
import MenuAcoes from '../components/MenuAcoes'
import EstadoVazio from '../components/EstadoVazio'

export default function Pessoas() {
  const [pessoas, setPessoas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null) // null = formulário fechado
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const { data, error } = await supabase.from('pessoas').select('*').order('nome')
    if (error) setErro('Não foi possível carregar as pessoas.')
    else setPessoas(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const temEu = pessoas.some((p) => p.eh_eu)

  async function criarEu() {
    setErro('')
    const { error } = await supabase.from('pessoas').insert({ nome: 'Eu', eh_eu: true })
    if (error) setErro('Não foi possível criar o seu cadastro.')
    await carregar()
  }

  async function salvar(evento) {
    evento.preventDefault()
    const nome = form.nome.trim()
    if (!nome) {
      setErro('Informe o nome da pessoa.')
      return
    }
    setErro('')
    setSalvando(true)
    const dados = { nome, observacao: form.observacao.trim() || null }
    const { error } = form.id
      ? await supabase.from('pessoas').update(dados).eq('id', form.id)
      : await supabase.from('pessoas').insert(dados)
    setSalvando(false)
    if (error) {
      setErro('Não foi possível salvar. Tente de novo.')
      return
    }
    setForm(null)
    await carregar()
  }

  async function alternarAtiva(pessoa) {
    setErro('')
    const { error } = await supabase
      .from('pessoas')
      .update({ ativa: !pessoa.ativa })
      .eq('id', pessoa.id)
    if (error) setErro('Não foi possível alterar o status.')
    await carregar()
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Pessoas</h1>
        {!form && (
          <button
            className="botao-primario pequeno"
            onClick={() => {
              setErro('')
              setForm({ id: null, nome: '', observacao: '' })
            }}
          >
            Nova pessoa
          </button>
        )}
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {!carregando && !temEu && (
        <div className="bloco">
          <p>
            Cadastre você mesmo como pessoa. Assim dá para dividir compras entre você e
            outras pessoas, ou lançar compras que são só suas.
          </p>
          <button className="botao-primario pequeno" onClick={criarEu}>
            Cadastrar meu perfil
          </button>
        </div>
      )}

      {form && (
        <form className="bloco formulario" onSubmit={salvar}>
          <label className="campo">
            Nome
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoFocus
            />
          </label>
          <label className="campo">
            Observação (opcional)
            <textarea
              rows={2}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </label>
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
        ) : pessoas.length === 0 ? (
          <EstadoVazio
            simples
            Icone={Users}
            titulo="Nenhuma pessoa cadastrada"
            texto="Cadastre as pessoas que usam seus cartões para poder dividir as compras."
          />
        ) : (
          <ul className="lista">
            {pessoas.map((p) => (
              <li key={p.id} className={p.ativa ? 'linha' : 'linha desativada'}>
                <Link className="item-link" to={`/pessoas/${p.id}`}>
                  <div className="item-texto">
                    <div className="titulo">
                      {p.nome}
                      {p.eh_eu && <span className="chip">Você</span>}
                      {!p.ativa && <span className="chip inativo">Inativa</span>}
                    </div>
                    {p.observacao && <div className="detalhe">{p.observacao}</div>}
                  </div>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
                <MenuAcoes
                  itens={[
                    {
                      rotulo: 'Editar',
                      Icone: Pencil,
                      aoClicar: () => {
                        setErro('')
                        setForm({ id: p.id, nome: p.nome, observacao: p.observacao ?? '' })
                      },
                    },
                    ...(p.eh_eu
                      ? []
                      : [
                          {
                            rotulo: p.ativa ? 'Desativar' : 'Ativar',
                            Icone: Power,
                            aoClicar: () => alternarAtiva(p),
                          },
                        ]),
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
