import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LiveReload from './components/LiveReload'
import Sidebar from './components/Sidebar'
import DocPage from './pages/DocPage'
import Home from './pages/Home'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <div className="flex min-h-screen text-[var(--color-text)]" style={{ backgroundColor: 'var(--color-bg)' }}>
        <LiveReload />
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/doc/:slug" element={<DocPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  </React.StrictMode>,
)
