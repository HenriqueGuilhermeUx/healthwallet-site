'use client'

import { ReactNode } from 'react'
import ProRouteGuard from '@/components/ProRouteGuard'

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <ProRouteGuard
      featureKey="crm_smartbots"
      featureName="CRM SmartBots"
      description="Lembretes, follow-up, tarefas comerciais, reativação de pacientes e automações fazem parte do MyDataMed Pro."
    >
      {children}
    </ProRouteGuard>
  )
}
