import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/bootstrap-custom.scss'
import './styles/global.css'
import './styles/transitions.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
