import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/main.css'

interface ErrorBoundaryState {
  error: Error | null
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="h-screen w-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-base font-bold text-rose-400 mb-2">
            Ocorreu um erro ao renderizar a interface
          </h1>
          <pre className="text-xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-xl p-4 max-w-xl overflow-auto mb-4">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition cursor-pointer"
          >
            Recarregar Aplicativo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)
