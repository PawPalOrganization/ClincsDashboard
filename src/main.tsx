import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/bootstrap-custom.scss'
import './styles/global.css'
import './styles/transitions.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,   // data is "fresh" for 30 s — no refetch within that window
      retry: 1,            // one retry on network failures
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
