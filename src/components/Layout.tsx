'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'
import Link from 'next/link'
import { Brain, BriefcaseBusiness, ClipboardCheck, ClipboardList, FileSearch, FileText, Heart, LogOut, MonitorSmartphone, ShieldCheck, SlidersHorizontal, User } from 'lucide-react'
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

  const canShowRegulated = professional?.professional_type === 'medico'

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">HealthWallet<span className="text-emerald-600">.pro</span></span>
        </Link>

        {user && professional && (
          <div className="flex items-center gap-1 md:gap-2 overflow-x-auto">
            <NavLink href="/consultorio" icon={BriefcaseBusiness} label="Consultório" tone="emerald" />
            <NavLink href="/recepcao-autoatendimento" icon={MonitorSmartphone} label="Recepção" tone="emerald" />
            <NavLink href="/pre-atendimento" icon={ClipboardList} label="Pré" tone="emerald" />
            <NavLink href="/entrada-paciente" icon={ClipboardCheck} label="Entrada" tone="blue" />
            <NavLink href="/consulta-assistida" icon={Brain} label="Atendimento IA" tone="violet" />
            <NavLink href="/meu-jeito-atender" icon={SlidersHorizontal} label="Meu jeito" tone="violet" />
            <NavLink href="/lgpd-consultorio" icon={ShieldCheck} label="LGPD" tone="blue" />
            {canShowRegulated && (
              <>
                <NavLink href="/prescriptions" icon={FileText} label="Receitas" tone="emerald" />
                <NavLink href="/exam-requests" icon={FileSearch} label="Pedidos" tone="sky" />
              </>
            )}
            <div className="hidden lg:flex items-center gap-2 text-sm text-gray-600 ml-1">
              <User className="w-4 h-4" />
              <span>{professional.full_name}</span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                {professional.professional_type}
              </span>
            </div>
            <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

function NavLink({ href, icon: Icon, label, tone }: any) {
  const styles: Record<string, string> = {
    emerald: 'hover:text-emerald-700 hover:bg-emerald-50',
    violet: 'hover:text-violet-700 hover:bg-violet-50',
    blue: 'hover:text-blue-700 hover:bg-blue-50',
    sky: 'hover:text-sky-700 hover:bg-sky-50',
  }
  return (
    <Link href={href} className={`flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors flex-shrink-0 ${styles[tone] || styles.emerald}`}>
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}
