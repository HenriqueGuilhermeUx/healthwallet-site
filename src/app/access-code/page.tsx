'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AccessCodePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleAccess() {
  if (!code.trim()) {
    alert('Digite o código de acesso')
    return
  }

  setLoading(true)

  const normalizedCode = code.trim().toUpperCase()

  const { data, error } = await supabase
    .from('shared_access')
    .select('*')
    .eq('access_code', normalizedCode)
    .maybeSingle()

  setLoading(false)

  if (error) {
    alert(`Erro Supabase: ${error.message}`)
    return
  }

  if (!data) {
    alert('Código não encontrado')
    return
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    alert('Código expirado')
    return
  }

  router.push(`/patient/${data.patient_id}/summary`)
}

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="bg-white rounded-2xl border p-6 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-bold mb-2">
          Acessar dados do paciente
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          Digite o código compartilhado pelo paciente no HealthWallet.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ex: ABC123"
          className="w-full border rounded-xl px-4 py-3 mb-4 uppercase"
        />

        <button
          onClick={handleAccess}
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium"
        >
          {loading ? 'Validando...' : 'Acessar Snapshot'}
        </button>
      </div>
    </main>
  )
}
