import { createContext, useContext, useState, useEffect } from 'react'
import { fetchCurrentUser, logoutUser, upgradePlan, resetQuota, triggerTrialAction, type UserProfile } from '../lib/api'

interface AuthContextType {
  user: UserProfile | null
  loading: boolean
  setUser: (user: UserProfile | null) => void
  logout: () => Promise<void>
  upgrade: (plan: 'free' | 'pro') => Promise<void>
  resetUsage: () => Promise<void>
  trialAction: (action: 'activate_trial' | 'expire_trial' | 'reset_returns') => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: async () => {},
  upgrade: async () => {},
  resetUsage: async () => {},
  trialAction: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const u = await fetchCurrentUser()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const logout = async () => {
    await logoutUser()
    setUser(null)
  }

  const upgrade = async (plan: 'free' | 'pro') => {
    await upgradePlan(plan)
    await refreshUser()
  }

  const resetUsage = async () => {
    await resetQuota()
    await refreshUser()
  }

  const trialAction = async (action: 'activate_trial' | 'expire_trial' | 'reset_returns') => {
    await triggerTrialAction(action)
    await refreshUser()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        setUser,
        logout,
        upgrade,
        resetUsage,
        trialAction,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
