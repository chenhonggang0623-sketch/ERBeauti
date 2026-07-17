import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const ROOT_EL = document.getElementById('root')!

let retries = 0
const MAX_RETRIES = 1

function mount() {
  const root = createRoot(ROOT_EL)
  root.render(<App />)
  return root
}

let root = mount()

function isRecoverable(msg: string) {
  return msg.includes('removeChild') || msg.includes('NotFoundError')
}

window.addEventListener('error', (e: ErrorEvent) => {
  if (!isRecoverable(e.message) || retries >= MAX_RETRIES) return
  e.preventDefault()
  e.stopImmediatePropagation?.()
  retries++
  setTimeout(() => {
    try {
      root.unmount()
    } catch {
      // root may already be in inconsistent state
    }
    root = mount()
  }, 0)
})
