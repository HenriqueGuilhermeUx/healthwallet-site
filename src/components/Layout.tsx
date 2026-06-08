'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'
import Link from 'next/link'
import { Heart, LogOut, User, FileText } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster position="top-center" richColors />
    </AuthProvider>
  )
}

export function Header() {
  const { user, professional, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">HealthWallet<span className="text-emerald-600">.pro</span></span>
        </Link>

        {user && professional && (
          <div className="flex items-center gap-3">
            {professional.professional_type === 'medico' && (
              <>
                <Link
                  href="/prescriptions"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Receitas</span>
                </Link>
                <Link
                  href="/exam-requests"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                >
                  <FileSearch className="w-4 h-4" />
                  <span className="hidden sm:inline">Pedidos</span>
                </Link>
              </>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span className="hidden md:inline">{professional.full_name}</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                {professional.professional_type}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
