import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useStore } from './store/store'
import { createStorageAdapter, startPersistence } from './storage'

async function boot() {
  // Load saved state before the first render so the seed never flashes on screen.
  const persistence = await startPersistence(useStore, createStorageAdapter())
  // Save any pending change when the tab is hidden or closed.
  window.addEventListener('pagehide', () => void persistence.flush())

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
