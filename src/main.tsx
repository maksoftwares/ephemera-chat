import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload()
})

createRoot(document.getElementById('root')!).render(<App />)
