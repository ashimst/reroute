import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import DemoPage from './pages/DemoPage'
import InfoPage from './pages/InfoPage'
import WorkspacePage from './pages/WorkspacePage'
import ComingSoonPage from './pages/ComingSoonPage'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function AppRoutes() {
  const { user, setUser } = useAuth()

  return (
    <Layout>
      <Routes>
        {/* Dedicated Product Homepage */}
        <Route path="/" element={<HomePage />} />

        {/* All-in-One Demo Sandbox */}
        <Route path="/demo" element={<DemoPage />} />

        {/* Deep link aliases to Demo Sandbox tabs */}
        <Route path="/chat" element={<Navigate to="/demo?tab=chat" replace />} />
        <Route path="/submit" element={<Navigate to="/demo?tab=studio" replace />} />
        <Route path="/orders" element={<Navigate to="/demo?tab=lookup" replace />} />
        <Route path="/history" element={<Navigate to="/demo?tab=history" replace />} />

        {/* Cognitive Architecture & Specs */}
        <Route path="/info" element={<InfoPage />} />

        {/* Self-Host & Enterprise VPC Deployment */}
        <Route path="/deploy" element={<ComingSoonPage />} />
        
        {/* Redirect legacy workspace to Studio with engine tuning */}
        <Route path="/workspace" element={<Navigate to="/demo?tab=studio" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
