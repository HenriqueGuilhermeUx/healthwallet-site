'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Heart, Mail, Lock, Loader2, ShieldCheck } from 'lucide-react'

const NEXA_API_URL = 'https://nexa-backend-p2u0.onrender.com/api/v1'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [nexaLoading, setNexaLoading] = useState(false)

  const { signIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const nexaToken = searchParams.get('nexaToken')

    if (nexaToken) {
      loginWithNexaToken(nexaToken)
    }
  }, [searchParams])

  const loginWithNexaToken = async (nexaToken: string) => {
    setNexaLoading(true)

    try {
      const response = await fetch(`${NEXA_API_URL}/nexa-id/validate/${nexaToken}`)
      const data = await response.json()

      if (!data.success || !data.user) {
        toast.error('Token Nexa ID inválido ou expirado')
        return
      }

      localStorage.setItem('nexa_user', JSON.stringify(data.user))
      localStorage.setItem('nexa_token', nexaToken)

      toast.success(`Bem-vindo, ${data.user.fullName || data.user.username}!`)
      router.push('/dashboard')
    } catch (err) {
      toast.error('Erro ao entrar com Nexa ID')
    } finally {
      setNexaLoading(false)
    }
  }

  const handleNexaLogin = () => {
    toast.info('Abra pelo app Nexa para entrar automaticamente com Nexa ID.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        toast.error(error.message || 'Erro ao fazer login')
        return
      }

      toast.success('Login realizado com sucesso!')
      router.push('/dashboard')
    } catch (err) {
      toast.error('Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
            <p className="text-gray-600 mt-2">Acesse sua conta de profissional</p>
          </div>

          {nexaLoading ? (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <div>
                <p className="font-semibold text-blue-900">Validando Nexa ID...</p>
                <p className="text-sm text-blue-700">Aguarde um instante.</p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleNexaLogin}
            disabled={nexaLoading}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-5"
          >
            <ShieldCheck className="w-5 h-5" />
            Entrar com Nexa ID
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-400 font-medium">ou entre com e-mail</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Não tem conta?{' '}
              <Link href="/register" className="text-emerald-600 font-medium hover:underline">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
