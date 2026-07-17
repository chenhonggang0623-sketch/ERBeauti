import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from '@/pages/HomePage'
import EditorPage from '@/pages/EditorPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary name="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ErrorBoundary name="HomePage">
                <HomePage />
              </ErrorBoundary>
            }
          />
          <Route
            path="/editor"
            element={
              <ErrorBoundary name="EditorPage">
                <EditorPage />
              </ErrorBoundary>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
