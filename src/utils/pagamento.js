import { supabase } from '../supabaseClient'
import { hojeISO } from './meses'

// Marcar como pago NUNCA altera o valor; só o status e a data do pagamento.
export const definirPago = (id, pago) =>
  supabase
    .from('lancamento_participacoes')
    .update({ pago, pago_em: pago ? hojeISO() : null })
    .eq('id', id)

export const definirPagoVarios = (ids, pago) =>
  supabase
    .from('lancamento_participacoes')
    .update({ pago, pago_em: pago ? hojeISO() : null })
    .in('id', ids)

export const salvarObservacaoPagamento = (id, texto) =>
  supabase
    .from('lancamento_participacoes')
    .update({ observacao: texto.trim() || null })
    .eq('id', id)
