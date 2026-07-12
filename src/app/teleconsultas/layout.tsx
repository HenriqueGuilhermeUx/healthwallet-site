'use client'

import { ReactNode } from 'react'
import ProRouteGuard from '@/components/ProRouteGuard'

export default function TeleconsultasLayout({ children }: { children: ReactNode }) {
  return (
    <ProRouteGuard
      featureKey="teleconsultation"
      featureName="Teleconsultas"
      description="Agenda, confirmação, chamada, lembretes, orientações e fluxo comercial de atendimento fazem parte do MyDataMed Pro."
    >
      {children}
    </ProRouteGuard>
  )
}
