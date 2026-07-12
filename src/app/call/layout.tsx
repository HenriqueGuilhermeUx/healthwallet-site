'use client'

import { ReactNode } from 'react'
import ProRouteGuard from '@/components/ProRouteGuard'

export default function CallLayout({ children }: { children: ReactNode }) {
  return (
    <ProRouteGuard
      featureKey="teleconsultation"
      featureName="Chamadas embutidas"
      description="A chamada Daily embutida faz parte do MyDataMed Pro. O acesso gratuito aos dados autorizados dos pacientes continua liberado no dashboard."
    >
      {children}
    </ProRouteGuard>
  )
}
