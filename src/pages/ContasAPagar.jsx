import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Clock, CreditCard, Repeat, Sparkles, TriangleAlert, CircleCheck, Calendar } from 'lucide-react'
import { useAvisos } from '../components/AvisosContext'
import BannerContas from '../components/BannerContas'
import EstadoVazio from '../components/EstadoVazio'
import { centavosParaReais } from '../utils/dinheiro'
import { formatarData } from '../utils/meses'
import { ORDEM_GRUPOS, diaEMes, grupoConta, hojeLocal } from '../utils/vencimentos'

const FILTROS = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'apagar', rotulo: 'A pagar' },
  { valor: 'pagas', rotulo: 'Pagas' },
]

const TIPOS = {
  cartao: { Icone: CreditCard, rotulo: 'Fatura do cartão' },
  fixo: { Icone: Repeat, rotulo: 'Gasto fixo' },
  extra: { Icone: Sparkles, rotulo: 'Extra' },
}

const ICONE_ESTADO = {
  atrasada: TriangleAlert,
  hoje: Clock,
  breve: Clock,
  normal: Calendar,
  paga: CircleCheck,
}

export default function ContasAPagar() {
  const { itens, semVencimento, carregando, erro, marcarPaga } = useAvisos()
  const [filtro, setFiltro] = useState('todas')
  const [aviso, setAviso] = useState('')

  async function alternar(item) {
    setAviso('')
    const ok = await marcarPaga(item, !item.paga)
    if (!ok) setAviso('Não foi possível atualizar o pagamento. Tente de novo.')
  }

  if (carregando) return <p className="suave">Carregando…</p>

  const visiveis = itens.filter(
    (i) => filtro === 'todas' || (filtro === 'apagar' && !i.paga) || (filtro === 'pagas' && i.paga)
  )

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Contas a pagar</h1>
          <div className="detalhe">Hoje é {formatarData(hojeLocal())}</div>
        </div>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {aviso && <p className="erro" role="alert">{aviso}</p>}

      <BannerContas />

      {semVencimento > 0 && (
        <div className="aviso aviso-acao" style={{ marginBottom: 12 }}>
          <span>
            {semVencimento} {semVencimento === 1 ? 'gasto' : 'gastos'} deste mês e do próximo sem
            vencimento definido.
          </span>
          <Link className="botao-secundario compacto" to="/fixos">Definir vencimentos</Link>
        </div>
      )}

      {itens.length === 0 ? (
        <EstadoVazio
          Icone={CalendarClock}
          titulo="Nenhuma conta com vencimento"
          texto="As faturas dos cartões aparecem sozinhas. Para os gastos fixos e extras, defina o vencimento ao lançar ou depois, no menu de cada item."
        >
          <Link className="botao-primario" to="/fixos">Ver gastos fixos</Link>
          <Link className="botao-secundario" to="/cartoes">Ver cartões</Link>
        </EstadoVazio>
      ) : (
        <>
          <div className="segmentos" role="group" aria-label="Filtrar contas" style={{ marginBottom: 12 }}>
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                className={filtro === f.valor ? 'ativo' : ''}
                onClick={() => setFiltro(f.valor)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {visiveis.length === 0 && <p className="suave">Nada para mostrar neste filtro.</p>}

          {ORDEM_GRUPOS.map((grupo) => {
            const lista = visiveis.filter((i) => grupoConta(i.est) === grupo)
            if (lista.length === 0) return null
            return (
              <div key={grupo} className="grupo-contas">
                <div className="grupo-titulo">
                  {grupo} ({lista.length})
                </div>
                {lista.map((item) => {
                  const { dia, mes } = diaEMes(item.venc)
                  const tipo = TIPOS[item.tipo]
                  const IconeEstado = ICONE_ESTADO[item.est.chave]
                  return (
                    <div key={item.chave} className="conta">
                      <div className="conta-topo">
                        <div className={`selo-data estado-${item.est.chave}`}>
                          <b>{dia}</b>
                          <span>{mes}</span>
                        </div>
                        <div className="item-texto">
                          <Link to={item.para} className="conta-nome">{item.nome}</Link>
                          <div className="detalhe">
                            <tipo.Icone size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} />{' '}
                            {tipo.rotulo}
                            {item.estimado && ' · valor estimado'}
                          </div>
                          {item.receber > 0 && !item.paga && (
                            <div className="detalhe">
                              Falta receber {centavosParaReais(item.receber)} das pessoas
                            </div>
                          )}
                        </div>
                        <div className="conta-valor">{centavosParaReais(item.valor)}</div>
                      </div>
                      <div className="conta-base">
                        <span className={`estado estado-${item.est.chave}`}>
                          <IconeEstado size={14} aria-hidden="true" />
                          {item.est.texto}
                        </span>
                        <button className="botao-secundario compacto" onClick={() => alternar(item)}>
                          {item.paga ? 'Desfazer' : 'Marcar como paga'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}
