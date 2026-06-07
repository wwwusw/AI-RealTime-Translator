import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const FloatingApp = lazy(() => import('./FloatingApp'))

const isFloatingMode = () => {
  const params = new URLSearchParams(window.location.search)
  return params.get('mode') === 'floating'
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isFloatingMode() ? (
      <Suspense fallback={<div />}>
        <FloatingApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
)
