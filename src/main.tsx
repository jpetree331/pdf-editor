import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { configurePdfjsWorker } from './lib/render/pdfjsLoader'
import './styles/base.css'

configurePdfjsWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
