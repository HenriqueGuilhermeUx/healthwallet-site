'use client'

import { ReactNode } from 'react'
import ProRouteGuard from '@/components/ProRouteGuard'

export default function AssinaturasLayout({ children }: { children: ReactNode }) {
  return (
    <ProRouteGuard
      featureKey="professional_documents"
      featureName="Documentos profissionais"
      description="Documentos, assinatura profissional, validação pública, receitas quando aplicável e envio ao paciente fazem parte do MyDataMed Pro."
    >
      {children}
    </ProRouteGuard>
  )
}
