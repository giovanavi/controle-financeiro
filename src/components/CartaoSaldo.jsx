import { useState } from 'react'
import { Link } from 'react-router-dom'
import { centavosParaReais } from '../utils/dinheiro'
import '../saldo.css'

// Duas visões do mês:
//  - Sobra: receitas menos o SEU gasto real (só a sua parte) e os encargos. É a conta de planejamento.
//  - Fluxo de caixa: o que passa pela sua conta. Você paga a fatura inteira ao banco e as pessoas
//    devolvem a parte delas depois, então o caixa fica abaixo da sobra até os reembolsos chegarem.
export default function CartaoSaldo({
  mesISO,
  receitaPrevista,
  receitaRecebida,
  receitasDisponiveis,
  gastoReal,
  encargos,
  saidas, // { fixos, faturas, extras, encargos } valores totais pagos
  reembolsoRecebido,
  reembolsoPendente,
}) {
  const [visao, setVisao] = useState('sobra')

  const sobra = receitaPrevista - gastoReal - encargos
  const comprometido = receitaPrevista > 0 ? Math.round(((gastoReal + encargos) / receitaPrevista) * 100) : 0
  const reembolsoTotal = reembolsoRecebido + reembolsoPendente
  const totalSaidas = saidas.fixos + saidas.faturas + saidas.extras + saidas.encargos
  const caixa = receitaPrevista + reembolsoTotal - totalSaidas

  const corBarra = comprometido > 100 ? 'alta' : comprometido >= 80 ? 'media' : ''

  return (
    <div className="bloco saldo">
      <div className="segmentos" role="group" aria-label="Visão do saldo">
        <button className={visao === 'sobra' ? 'ativo' : ''} onClick={() => setVisao('sobra')}>
          Sobra do mês
        </button>
        <button className={visao === 'caixa' ? 'ativo' : ''} onClick={() => setVisao('caixa')}>
          Fluxo de caixa
        </button>
      </div>

      {visao === 'sobra' ? (
        <>
          <div>
            <div className="detalhe">Sobra prevista</div>
            <div className={sobra < 0 ? 'saldo-grande negativo' : 'saldo-grande'}>
              {centavosParaReais(sobra)}
            </div>
          </div>

          <div className="saldo-linha">
            <span>Receitas do mês</span>
            <span>{centavosParaReais(receitaPrevista)}</span>
          </div>
          <div className="saldo-linha">
            <span>
              Gasto real
              <span className="sub">só a sua parte: fixos, faturas e extras</span>
            </span>
            <span>− {centavosParaReais(gastoReal)}</span>
          </div>
          {encargos > 0 && (
            <div className="saldo-linha">
              <span>
                Encargos
                <span className="sub">juros e taxas das faturas</span>
              </span>
              <span>− {centavosParaReais(encargos)}</span>
            </div>
          )}

          {receitaPrevista > 0 ? (
            <>
              <div className={`barra ${corBarra}`}>
                <span style={{ width: `${Math.min(comprometido, 100)}%` }} />
              </div>
              <div className="detalhe">
                {comprometido}% da receita comprometida · já recebido {centavosParaReais(receitaRecebida)}
              </div>
            </>
          ) : (
            <div className="aviso aviso-acao">
              <span>
                {receitasDisponiveis
                  ? 'Nenhuma receita neste mês. Cadastre as suas entradas para ver a sobra.'
                  : 'Receitas ainda não disponíveis. Rode o funcoes7.sql no Supabase.'}
              </span>
              {receitasDisponiveis && (
                <Link className="botao-secundario compacto" to={`/receitas?mes=${mesISO}`}>
                  Cadastrar receita
                </Link>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <div className="detalhe">Resultado do caixa no mês</div>
            <div className={caixa < 0 ? 'saldo-grande negativo' : 'saldo-grande'}>
              {centavosParaReais(caixa)}
            </div>
          </div>

          <div className="saldo-linha">
            <span>Receitas</span>
            <span>{centavosParaReais(receitaPrevista)}</span>
          </div>
          <div className="saldo-linha">
            <span>
              Reembolsos das pessoas
              <span className="sub">
                recebido {centavosParaReais(reembolsoRecebido)} · falta {centavosParaReais(reembolsoPendente)}
              </span>
            </span>
            <span>{centavosParaReais(reembolsoTotal)}</span>
          </div>
          <div className="saldo-linha">
            <span>
              Saídas
              <span className="sub">
                fixos {centavosParaReais(saidas.fixos)} · faturas inteiras {centavosParaReais(saidas.faturas)} ·
                extras {centavosParaReais(saidas.extras)}
                {saidas.encargos > 0 && ` · encargos ${centavosParaReais(saidas.encargos)}`}
              </span>
            </span>
            <span>− {centavosParaReais(totalSaidas)}</span>
          </div>

          <p className="dica" style={{ margin: 0 }}>
            Você paga a fatura inteira ao banco e as pessoas devolvem a parte delas depois.
            {reembolsoPendente > 0 &&
              ` Quando os ${centavosParaReais(reembolsoPendente)} que faltam chegarem, o caixa fecha em ${centavosParaReais(sobra)}, igual à sobra.`}
          </p>
        </>
      )}
    </div>
  )
}
