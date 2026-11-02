import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import EstadoVazio from '../components/EstadoVazio'
import MenuAcoes from '../components/MenuAcoes'
import CampoData from '../components/CampoData'
import { useDialogo } from '../components/Dialogo'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { formatarData, hojeISO, mesAtual, mesDeISO, mesParaISO, rotuloMes } from '../utils/meses'
import { diasAte, plural } from '../utils/vencimentos'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

// cor + texto do estado de uma receita (reaproveita as cores das contas)
function estadoReceita(r) {
  if (r.recebida) {
    return { chave: 'paga', texto: r.recebida_em ? `Recebida em ${formatarData(r.recebida_em)}` : 'Recebida' }
  }
  const dias = diasAte(r.data_prevista)
  if (dias < 0) return { chave: 'hoje', texto: `Esperada há ${plural(-dias)}` }
  if (dias === 0) return { chave: 'hoje', texto: 'Esperada hoje' }
  return { chave: 'normal', texto: `Prevista para ${formatarData(r.data_prevista)}` }
}

export default function Receitas() {
  const { confirmar, escolher } = useDialogo()
  const [params] = useSearchParams()
  const mesDoLink = params.get('mes')
  const [mes, setMes] = useState(
    mesDoLink && /^\d{4}-\d{2}-01$/.test(mesDoLink) ? mesDeISO(mesDoLink) : mesAtual()
  )
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(null) // null = formulário fechado
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('receitas')
      .select('*')
      .eq('mes_referencia', mesParaISO(mes))
      .order('data_prevista')
    if (error) setErro('Não foi possível carregar as receitas. Confira se o funcoes7.sql foi executado.')
    else {
      setErro('')
      setItens(data)
    }
    setCarregando(false)
  }, [mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  const previsto = soma(itens, (r) => r.valor_centavos)
  const recebido = soma(itens.filter((r) => r.recebida), (r) => r.valor_centavos)

  function novaReceita() {
    setErro('')
    const atual = mesAtual()
    const noMesAtual = atual.ano === mes.ano && atual.mes === mes.mes
    setForm({
      id: null,
      grupoId: null,
      descricao: '',
      valor: '',
      data: noMesAtual ? hojeISO() : mesParaISO(mes),
      recorrente: false,
      fim: '',
      observacao: '',
    })
  }

  function editar(r) {
    setErro('')
    setForm({
      id: r.id,
      grupoId: r.grupo_id,
      descricao: r.descricao,
      valor: centavosParaCampo(r.valor_centavos),
      data: r.data_prevista,
      recorrente: false,
      fim: '',
      observacao: r.observacao ?? '',
    })
  }

  async function salvar(evento) {
    evento.preventDefault()
    const valor = reaisParaCentavos(form.valor)
    if (!form.descricao.trim()) return setErro('Informe a descrição.')
    if (!valor || valor <= 0) return setErro('Informe um valor maior que zero, por exemplo 3500,00.')
    if (!form.data) return setErro('Informe a data prevista no formato dd/mm/aaaa.')
    if (form.recorrente && form.fim && form.fim < form.data) {
      return setErro('O fim da repetição é anterior à data inicial.')
    }
    setErro('')

    // receita recorrente: pergunta se a mudança vale só para este mês ou também para os próximos
    let aPartirDaqui = false
    if (form.id && form.grupoId) {
      const escolha = await escolher({
        titulo: 'Aplicar a quais meses?',
        mensagem: 'Esta receita se repete todo mês. Meses já recebidos não são alterados.',
        opcoes: [
          { valor: 'este', rotulo: `Só ${rotuloMes(mes)}` },
          { valor: 'proximos', rotulo: 'Este e os próximos' },
        ],
      })
      if (!escolha) return
      aPartirDaqui = escolha === 'proximos'
    }

    setSalvando(true)
    const { error } = form.id
      ? await supabase.rpc('editar_receita', {
          p_receita_id: form.id,
          p_descricao: form.descricao.trim(),
          p_valor_centavos: valor,
          p_data: form.data,
          p_observacao: form.observacao.trim() || null,
          p_a_partir_daqui: aPartirDaqui,
        })
      : await supabase.rpc('criar_receita', {
          p_descricao: form.descricao.trim(),
          p_valor_centavos: valor,
          p_data: form.data,
          p_recorrente: form.recorrente,
          p_fim: form.recorrente && form.fim ? form.fim : null,
          p_observacao: form.observacao.trim() || null,
        })
    setSalvando(false)
    if (error) {
      setErro(error.code === 'P0001' ? error.message : 'Não foi possível salvar a receita.')
      return
    }

    // abre o mês da receita salva; se for o mesmo mês, só recarrega
    const destino = mesDeISO(`${form.data.slice(0, 7)}-01`)
    setForm(null)
    if (mesParaISO(destino) === mesParaISO(mes)) await carregar()
    else setMes(destino)
  }

  async function alternarRecebida(r) {
    setErro('')
    const recebida = !r.recebida
    const { error } = await supabase
      .from('receitas')
      .update({ recebida, recebida_em: recebida ? hojeISO() : null })
      .eq('id', r.id)
    if (error) setErro('Não foi possível atualizar a receita.')
    await carregar()
  }

  async function excluir(r) {
    let escopo = 'este'
    if (r.grupo_id) {
      const escolha = await escolher({
        titulo: 'Excluir esta receita?',
        mensagem: `“${r.descricao}” se repete todo mês. O que você quer excluir? Não dá para desfazer.`,
        opcoes: [
          { valor: 'este', rotulo: `Só ${rotuloMes(mes)}` },
          { valor: 'proximos', rotulo: 'Este e os próximos meses' },
        ],
        perigo: true,
      })
      if (!escolha) return
      escopo = escolha
    } else {
      const ok = await confirmar({
        titulo: 'Excluir receita?',
        mensagem: 'A receita será removida. Não dá para desfazer.',
        detalhes: [
          ['Receita', r.descricao],
          ['Valor', centavosParaReais(r.valor_centavos)],
          ['Mês', rotuloMes(mes)],
        ],
        confirmar: 'Excluir receita',
        perigo: true,
      })
      if (!ok) return
    }

    setErro('')
    const { error } = await supabase.from('receitas').delete().eq('id', r.id)
    if (error) {
      setErro('Não foi possível excluir a receita.')
    } else if (escopo === 'proximos') {
      // os meses seguintes da série que ainda não foram recebidos
      await supabase
        .from('receitas')
        .delete()
        .eq('grupo_id', r.grupo_id)
        .gt('mes_referencia', r.mes_referencia)
        .eq('recebida', false)
    }
    await carregar()
  }

  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Receitas</h1>
        {!form && (
          <button className="botao-primario pequeno" onClick={novaReceita}>
            <Plus size={16} aria-hidden="true" /> Nova receita
          </button>
        )}
      </div>

      <SeletorMes mes={mes} aoMudar={setMes} />

      {erro && <p className="erro" role="alert">{erro}</p>}

      {form && (
        <form className="bloco formulario" onSubmit={salvar}>
          <b>{form.id ? 'Editar receita' : 'Nova receita'}</b>
          <label className="campo">
            Descrição
            <input value={form.descricao} onChange={mudar('descricao')} placeholder="Salário" autoFocus />
          </label>
          <div className="duas-colunas">
            <label className="campo">
              Valor (R$)
              <input value={form.valor} onChange={mudar('valor')} inputMode="decimal" placeholder="0,00" />
            </label>
            <label className="campo">
              Data prevista
              <CampoData valor={form.data} aoMudar={(iso) => setForm({ ...form, data: iso })} />
            </label>
          </div>

          {!form.id && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
                />
                Repetir todo mês, a partir da data
              </label>
              {form.recorrente && (
                <>
                  <label className="campo">
                    Repetir até (opcional)
                    <CampoData valor={form.fim} aoMudar={(iso) => setForm({ ...form, fim: iso })} />
                  </label>
                  {!form.fim && <p className="dica">Sem data final, o sistema gera os próximos 12 meses.</p>}
                </>
              )}
            </>
          )}

          <label className="campo">
            Observação (opcional)
            <textarea rows={2} value={form.observacao} onChange={mudar('observacao')} />
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

      <div className="metricas">
        <div className="metrica">
          <div className="rotulo">Previsto no mês</div>
          <div className="numero">{centavosParaReais(previsto)}</div>
        </div>
        <div className="metrica">
          <div className="rotulo">Já recebido</div>
          <div className="numero">{centavosParaReais(recebido)}</div>
        </div>
        <div className="metrica">
          <div className="rotulo">Falta receber</div>
          <div className="numero">{centavosParaReais(previsto - recebido)}</div>
        </div>
      </div>

      {carregando ? (
        <p className="suave">Carregando…</p>
      ) : itens.length === 0 ? (
        <EstadoVazio
          Icone={TrendingUp}
          titulo={`Nenhuma receita em ${rotuloMes(mes)}`}
          texto="Cadastre seu salário e outras entradas para ver quanto sobra no mês. O salário pode se repetir sozinho todo mês."
        >
          {!form && (
            <button className="botao-primario" onClick={novaReceita}>
              <Plus size={18} aria-hidden="true" /> Nova receita
            </button>
          )}
        </EstadoVazio>
      ) : (
        itens.map((r) => {
          const est = estadoReceita(r)
          return (
            <div key={r.id} className="conta">
              <div className="conta-topo">
                <div className="item-texto">
                  <div className="conta-nome">{r.descricao}</div>
                  <div className="detalhe">
                    {r.grupo_id ? `Todo mês, dia ${r.data_prevista.slice(8, 10)}` : 'Avulsa'}
                    {r.observacao ? ` · ${r.observacao}` : ''}
                  </div>
                </div>
                <div className="valor-com-menu">
                  <span className="conta-valor">{centavosParaReais(r.valor_centavos)}</span>
                  <MenuAcoes
                    itens={[
                      { rotulo: 'Editar', Icone: Pencil, aoClicar: () => editar(r) },
                      { rotulo: 'Excluir', Icone: Trash2, perigo: true, aoClicar: () => excluir(r) },
                    ]}
                  />
                </div>
              </div>
              <div className="conta-base">
                <span className={`estado estado-${est.chave}`}>{est.texto}</span>
                <button className="botao-secundario compacto" onClick={() => alternarRecebida(r)}>
                  {r.recebida ? 'Desfazer' : 'Marcar como recebida'}
                </button>
              </div>
            </div>
          )
        })
      )}
    </section>
  )
}
