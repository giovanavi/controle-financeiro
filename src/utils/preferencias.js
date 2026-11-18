// Preferências guardadas no próprio navegador (neste aparelho). Se o navegador bloquear o
// armazenamento, tudo continua funcionando, só que sem lembrar da última escolha.
const PREFIXO = 'cf:'

export function lerPreferencia(chave, padrao) {
  try {
    const valor = window.localStorage.getItem(PREFIXO + chave)
    return valor === null ? padrao : JSON.parse(valor)
  } catch {
    return padrao
  }
}

export function salvarPreferencia(chave, valor) {
  try {
    window.localStorage.setItem(PREFIXO + chave, JSON.stringify(valor))
  } catch {
    // sem armazenamento disponível: ignora
  }
}
