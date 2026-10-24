import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import SubmitPage from './pages/SubmitPage'
import OrderLookupPage from './pages/OrderLookupPage'
import HistoryPage from './pages/HistoryPage'
import ChatPage from './pages/ChatPage'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime:    5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/"        element={<ChatPage />} />
            <Route path="/submit"  element={<SubmitPage />} />
            <Route path="/orders"  element={<OrderLookupPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
