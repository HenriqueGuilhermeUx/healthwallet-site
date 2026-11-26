'use client'

import { ReactNode, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Toaster } from 'sonner'
import Link from 'next/link'
import {
  Brain,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSearch,
  FileText,
  Globe2,
  Heart,
  HeartPulse,
  Image,
  LogOut,
  MonitorSmartphone,
  MoreHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  UserCog,
  WalletCards,
  Watch,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [teamRole, setTeamRole] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTeamRole() {
      if (!user) {
        if (!cancelled) setTeamRole(null)
        return
      }

      const { data } = await supabase
        .from('mydatamed_team_members')
        .select('role,active')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!cancelled) setTeamRole(data?.active ? data.role : null)
    }

    void loadTeamRole()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const canShowRegulated = professional?.professional_type === 'medico'
  const canUseClinicalConcierge = !!teamRole && ['master', 'admin', 'care_coordinator', 'nurse', 'doctor'].includes(teamRole)
  const canUseExternalCoordination = !!teamRole && ['master', 'admin', 'care_coordinator', 'concierge_agent', 'nurse', 'doctor'].includes(teamRole)
  const isMaster = teamRole === 'master'

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl">MyData<span className="text-emerald-600">Med</span></span>
        </Link>

        {user && (professional || teamRole) && (
          <div className="flex items-center gap-1 md:gap-2">
            {professional && (
              <>
                <NavLink href="/pre-atendimento" icon={ClipboardList} label="Pré-consulta" tone="emerald" />
                <NavLink href="/agenda" icon={CalendarDays} label="Agenda" tone="emerald" />
                <NavLink href="/consulta-assistida" icon={Brain} label="Atendimento IA" tone="violet" />
                <NavLink href="/prontuario" icon={FileText} label="Prontuário" tone="blue" />
                <NavLink href="/cobrancas" icon={CreditCard} label="Cobranças" tone="blue" />
                <MoreMenu>
                  <MenuLink href="/consultorio" icon={BriefcaseBusiness} label="Consultório" />
                  <MenuLink href="/minha-pagina" icon={Globe2} label="Minha página" />
                  <MenuLink href="/midia" icon={Image} label="Mídia" />
                  <MenuLink href="/backoffice" icon={WalletCards} label="Backoffice" />
                  <MenuLink href="/modo" icon={Sparkles} label="MODO" />
                  <MenuLink href="/recepcao-autoatendimento" icon={MonitorSmartphone} label="Recepção" />
                  <MenuLink href="/entrada-paciente" icon={ClipboardCheck} label="Entrada de paciente" />
                  <MenuLink href="/dados-dispositivos" icon={Watch} label="Dispositivos" />
                  <MenuLink href="/meu-jeito-atender" icon={SlidersHorizontal} label="Meu jeito de atender" />
                  <MenuLink href="/lgpd-consultorio" icon={ShieldCheck} label="LGPD" />
                  {canShowRegulated && (
                    <>
                      <MenuLink href="/prescriptions" icon={FileText} label="Receitas" />
                      <MenuLink href="/exam-requests" icon={FileSearch} label="Pedidos de exame" />
                    </>
                  )}
                </MoreMenu>
              </>
            )}

            {canUseClinicalConcierge && (
              <NavLink href="/concierge/profissional" icon={HeartPulse} label="Concierge" tone="emerald" />
            )}

            {canUseExternalCoordination && (
              <NavLink href="/concierge/profissional/coordenacao" icon={CalendarCheck} label="Coordenação" tone="blue" />
            )}

            {isMaster && (
              <NavLink href="/master" icon={UserCog} label="Master" tone="violet" />
            )}

            {professional && (
              <div className="hidden xl:flex items-center gap-2 text-sm text-gray-600 ml-1">
                <User className="w-4 h-4" />
                <span>{professional.full_name}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                  {professional.professional_type}
                </span>
              </div>
            )}

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
    <Link
      href={href}
      className={'flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 rounded-lg transition-colors flex-shrink-0 ' + (styles[tone] || styles.emerald)}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}

// Itens secundários ficam num menu "Mais" para a barra mostrar só o fluxo
// principal: pré-consulta, agenda, atendimento, prontuário e cobrança.
function MoreMenu({ children }: { children: ReactNode }) {
  return (
    <details className="relative flex-shrink-0 group">
      <summary className="list-none cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Mais</span>
      </summary>
      <div className="absolute right-0 mt-2 w-60 rounded-2xl border bg-white p-2 shadow-lg z-50 grid gap-0.5">
        {children}
      </div>
    </details>
  )
}

function MenuLink({ href, icon: Icon, label }: any) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </Link>
  )
}
