import { useRegisterSW } from 'virtual:pwa-register/react'
import '../atualizacao.css'

const UMA_HORA = 60 * 60 * 1000

// Mostra "Nova versão disponível" quando você publica uma atualização. O app confere se há
// versão nova ao abrir e depois de hora em hora; só troca de versão quando você toca em Atualizar.
export default function AtualizacaoApp() {
  const {
    needRefresh: [precisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_endereco, registro) {
      if (registro) setInterval(() => registro.update(), UMA_HORA)
    },
  })

  if (!precisaAtualizar) return null

  return (
    <div className="atualizacao-app" role="status">
      <span>Nova versão disponível.</span>
      <button type="button" className="botao-primario pequeno" onClick={() => updateServiceWorker(true)}>
        Atualizar
      </button>
    </div>
  )
}
