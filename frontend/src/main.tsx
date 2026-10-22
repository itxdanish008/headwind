import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/jetbrains-mono'
// Global styles first, so component styles override shared utilities like .glass.
import './styles/tokens.css'
import './styles/base.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ThemeProvider from './theme/ThemeProvider'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
