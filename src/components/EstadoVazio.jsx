import '../estadovazio.css'

// Mostra uma mensagem amigável quando não há dados, com botões para o próximo passo.
// simples: versão sem borda, para usar dentro de um bloco que já tem moldura.
export default function EstadoVazio({ Icone, titulo, texto, simples = false, children }) {
  return (
    <div className={simples ? 'estado-vazio simples' : 'estado-vazio'}>
      {Icone && (
        <div className="estado-vazio-icone">
          <Icone size={28} aria-hidden="true" />
        </div>
      )}
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {children && <div className="estado-vazio-acoes">{children}</div>}
    </div>
  )
}
