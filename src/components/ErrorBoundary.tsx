import { Component, type ErrorInfo, type ReactNode, createElement } from 'react'

interface Props {
  children: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
  mountKey: number
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, mountKey: 0 }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, mountKey: 0 }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? `/${this.props.name}` : ''}]`, error.message)
  }

  private handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      mountKey: prev.mountKey + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return createElement('div', { className: 'flex min-h-screen items-center justify-center bg-[#0a0a0b] p-8', key: this.state.mountKey },
        createElement('div', { className: 'max-w-lg text-center' },
          createElement('div', { className: 'mb-4 text-6xl' }, '\u26A0\uFE0F'),
          createElement('h1', { className: 'mb-2 text-2xl font-bold text-white' }, '\u51FA\u9519\u4E86'),
          createElement('p', { className: 'mb-6 text-neutral-400' },
            this.props.name
              ? `\u201C${this.props.name}\u201D\u6A21\u5757\u53D1\u751F\u610F\u5916\u9519\u8BEF`
              : '\u9875\u9762\u53D1\u751F\u4E86\u610F\u5916\u9519\u8BEF'
          ),
          createElement('pre', { className: 'mb-6 max-h-32 overflow-auto rounded-lg bg-white/5 p-4 text-left text-sm text-red-400' },
            this.state.error?.message ?? ''
          ),
          createElement('div', { className: 'flex justify-center gap-4' },
            createElement('button',
              {
                onClick: this.handleRetry,
                className: 'rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3 text-white transition-transform hover:scale-105',
              },
              '\u91CD\u8BD5'
            ),
            createElement('button',
              {
                onClick: () => window.location.reload(),
                className: 'rounded-xl border border-white/20 bg-transparent px-8 py-3 text-white transition-transform hover:scale-105',
              },
              '\u5237\u65B0\u9875\u9762'
            ),
          )
        )
      )
    }
    return this.props.children
  }
}
