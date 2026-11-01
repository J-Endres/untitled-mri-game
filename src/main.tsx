import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { activityLog, errorMessage } from './services/activityLog'
import { mrx } from './services/mrx/config'
import './styles/global.css'

/** Finishes an MRX login if this page load is the redirect back from it. */
async function finishLogin() {
  if (mrx.mode !== 'oauth') return
  try {
    if (!(await mrx.auth.handleRedirect(window.location.href))) return
    activityLog.info('MRX login completed')
  } catch (e) {
    console.error(e)
    activityLog.error(errorMessage(e))
    window.alert(errorMessage(e))
  }
  window.history.replaceState(null, '', window.location.pathname)
}

void finishLogin().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
)
