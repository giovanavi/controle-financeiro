import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { DialogoProvider } from './components/Dialogo'
import { ToastProvider } from './components/Toasts'
import AtualizacaoApp from './components/AtualizacaoApp'
import './ux.css' // por último, para prevalecer sobre os outros estilos

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DialogoProvider>
        <ToastProvider>
          <App />
          <AtualizacaoApp />
        </ToastProvider>
      </DialogoProvider>
    </BrowserRouter>
  </StrictMode>
)
