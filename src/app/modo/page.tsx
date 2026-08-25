'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowRight, Bot, ClipboardList, FileText, Loader2, MessageCircle, PenLine, Sparkles, Wand2 } from 'lucide-react'

const templates = [
  { title: 'Post para Instagram', icon: PenLine, prompt: 'Crie um post educativo para pacientes sobre meu serviço principal, com linguagem simples e chamada para agendamento.' },
  { title: 'Mensagem de retorno', icon: MessageCircle, prompt: 'Crie uma mensagem de WhatsApp para lembrar o paciente de marcar retorno, de forma humana e profissional.' },
  { title: 'Orientação pós-atendimento', icon: FileText, prompt: 'Crie uma orientação pós-atendimento clara, sem diagnóstico novo, reforçando que o paciente deve seguir a orientação profissional.' },
  { title: 'Checklist da consulta', icon: ClipboardList, prompt: 'Crie um checklist de preparação para uma primeira consulta com perguntas e documentos importantes.' },
]

export default function ModoPage() {
  const { user, professional, session, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)
  const [prompt, setPrompt] = useState('')
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadSubscription()
  }, [user, professional])

  const usage = useMemo(() => {
    const included = Number(subscription?.included_modo_credits || 0)
    const used = Number(subscription?.used_modo_credits || 0)
    const remaining = Math.max(0, included - used)
    return { included, used, remaining, pct: included ? Math.min(100, Math.round((used / included) * 100)) : 0 }
  }, [subscription])

  async function loadSubscription() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('professional_commercial_subscriptions')
      .select('*')
      .eq('professional_user_id', user.id)
      .maybeSingle()
    setSubscription(data || null)
    setLoading(false)
  }

  async function recordModoUse(quantity = 10, text = prompt) {
    if (!session?.access_token) return toast.error('Sessão inválida')
    if (!text.trim()) return toast.error('Digite ou escolha uma solicitação')
    setRecording(true)
    try {
      const response = await fetch('/api/usage/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          event_type: 'modo_credit',
          quantity,
          source: 'modo_page',
          description: 'Uso da MODO no MyDataMed',
          metadata: { prompt_preview: text.slice(0, 160), plan_code: subscription?.plan_code || null },
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || 'Erro ao registrar uso')
      setSubscription(json.subscription || subscription)
      toast.success('Uso MODO registrado')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar uso MODO')
    } finally {
      setRecording(false)
    }
  }

  function openModo() {
    const base = process.env.NEXT_PUBLIC_MODO_URL || 'https://modo1.netlify.app'
    window.open(base, '_blank')
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-violet-950 to-emerald-950 text-white p-6 md:p-9 grid lg:grid-cols-[1fr_0.75fr] gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><Sparkles className="w-4 h-4" /> MODO dentro do MyDataMed</div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">Crie conteúdo, mensagens e materiais para seu consultório.</h1>
          <p className="text-white/70 mt-4 text-lg">Use a MODO para comunicação, educação do paciente, scripts de atendimento, posts, mensagens, orientações e materiais operacionais. O consumo é controlado por créditos do plano.</p>
          <button onClick={openModo} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white text-slate-950 px-5 py-3 font-bold">Abrir MODO <ArrowRight className="w-4 h-4" /></button>
        </div>
        <div className="rounded-3xl bg-white text-gray-900 p-5">
          <p className="text-xs text-gray-500">Créditos MODO</p>
          <h2 className="text-3xl font-bold">{usage.remaining} restantes</h2>
          <p className="text-sm text-gray-600 mt-1">{usage.used} usados de {usage.included} no ciclo atual.</p>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden mt-4"><div className="h-full bg-violet-600" style={{ width: `${usage.pct}%` }} /></div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-gray-900 flex items-center gap-2"><Wand2 className="w-5 h-5 text-violet-700" /> Solicitação rápida</h2>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex: crie uma mensagem para pacientes faltantes remarcando a consulta..." className="w-full min-h-[180px] rounded-2xl border border-gray-200 p-4 outline-none focus:ring-2 focus:ring-violet-500/20" />
          <button onClick={() => recordModoUse(10)} disabled={recording} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 text-white px-4 py-3 font-semibold disabled:opacity-60">
            {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
            Registrar uso e abrir MODO
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {templates.map((item) => (
            <button key={item.title} onClick={() => { setPrompt(item.prompt); recordModoUse(8, item.prompt) }} className="text-left rounded-3xl bg-white border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <item.icon className="w-7 h-7 text-violet-700 mb-4" />
              <h3 className="font-bold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-600 mt-2">{item.prompt}</p>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
