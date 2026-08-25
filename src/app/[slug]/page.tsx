'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, CalendarDays, CheckCircle, Globe2, HeartPulse, Instagram, Loader2, MapPin, MessageCircle, ShieldCheck, Stethoscope } from 'lucide-react'

const reservedSlugs = new Set(['api', 'login', 'register', 'dashboard', 'consultorio', 'planos', 'tour', 'prefeituras', 'recepcao-digital', 'recepcao-autoatendimento', 'pre-atendimento', 'entrada-paciente', 'consulta-assistida', 'minha-pagina', 'backoffice', 'lgpd-consultorio', 'prescriptions', 'exam-requests'])

export default function PublicProfilePage() {
  const params = useParams()
  const slug = String(params?.slug || '')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (slug) loadProfile(slug)
  }, [slug])

  async function loadProfile(value: string) {
    if (reservedSlugs.has(value)) {
      setProfile(null)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('professional_public_profiles')
      .select('*')
      .eq('public_slug', value)
      .eq('is_published', true)
      .maybeSingle()
    setProfile(data || null)
    setLoading(false)
  }

  if (loading) {
    return <main className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></main>
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <section className="max-w-lg text-center bg-white/10 border border-white/10 rounded-[2rem] p-8">
          <HeartPulse className="w-14 h-14 text-emerald-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Página não encontrada</h1>
          <p className="text-white/65 mt-2">Este link ainda não foi publicado ou não existe.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white">Ir para MyDataMed <ArrowRight className="w-4 h-4" /></Link>
        </section>
      </main>
    )
  }

  const color = profile.brand_color || '#059669'
  const ctaUrl = profile.primary_cta_url || profile.booking_url || whatsappUrl(profile.whatsapp)
  const services = Array.isArray(profile.services) ? profile.services : []
  const links = Array.isArray(profile.bio_links) ? profile.bio_links : []

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="relative overflow-hidden text-white" style={{ background: `linear-gradient(135deg, #020617, ${color})` }}>
        {profile.cover_image_url && <img src={profile.cover_image_url} alt="Capa" className="absolute inset-0 w-full h-full object-cover opacity-20" />}
        <div className="relative max-w-5xl mx-auto px-4 py-10 md:py-16">
          <div className="flex flex-col md:flex-row gap-6 md:items-center">
            <div className="w-28 h-28 rounded-3xl bg-white/15 border border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
              {profile.avatar_url || profile.logo_url ? <img src={profile.avatar_url || profile.logo_url} alt={profile.display_name} className="w-full h-full object-cover" /> : <Stethoscope className="w-12 h-12 text-white" />}
            </div>
            <div className="flex-1">
              <p className="text-emerald-100 text-sm font-semibold mb-2">{profile.professional_title || profile.specialty || 'Profissional de saúde'}</p>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">{profile.display_name}</h1>
              {profile.headline && <p className="text-white/80 text-lg mt-4 max-w-3xl">{profile.headline}</p>}
              <div className="flex flex-wrap gap-2 mt-5 text-sm text-white/80">
                {profile.specialty && <Tag icon={Stethoscope} text={profile.specialty} />}
                {profile.service_mode && <Tag icon={CalendarDays} text={modeLabel(profile.service_mode)} />}
                {(profile.city || profile.state) && <Tag icon={MapPin} text={[profile.city, profile.state].filter(Boolean).join(' / ')} />}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            {ctaUrl && <a href={ctaUrl} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-bold text-slate-950 hover:bg-emerald-50">{profile.primary_cta_label || 'Agendar atendimento'} <ArrowRight className="w-5 h-5" /></a>}
            {profile.whatsapp && <a href={whatsappUrl(profile.whatsapp)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/15 px-6 py-4 font-semibold hover:bg-white/15"><MessageCircle className="w-5 h-5" /> WhatsApp</a>}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_0.72fr] gap-6">
        <div className="space-y-6">
          <Card title="Sobre" icon={HeartPulse}>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{profile.bio || 'Página profissional publicada no MyDataMed.'}</p>
            {profile.patient_audience && <p className="mt-4 text-sm text-gray-500"><strong>Público atendido:</strong> {profile.patient_audience}</p>}
          </Card>

          {services.length > 0 && (
            <Card title="Serviços e pacotes" icon={CheckCircle}>
              <div className="grid md:grid-cols-2 gap-3">
                {services.map((service: any, index: number) => (
                  <div key={index} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="font-bold text-gray-900">{service.title || service.name}</p>
                    {service.description && <p className="text-sm text-gray-600 mt-1">{service.description}</p>}
                    {service.price && <p className="text-sm font-semibold text-emerald-700 mt-3">{service.price}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card title="Links" icon={Globe2}>
            <div className="space-y-2">
              {profile.booking_url && <PublicLink href={profile.booking_url} label="Agenda online" />}
              {profile.instagram_url && <PublicLink href={profile.instagram_url} label="Instagram" icon={Instagram} />}
              {profile.website_url && <PublicLink href={profile.website_url} label="Site" />}
              {links.map((link: any, index: number) => link.url ? <PublicLink key={index} href={link.url} label={link.label || 'Abrir link'} /> : null)}
            </div>
          </Card>

          <Card title="Segurança" icon={ShieldCheck}>
            <p className="text-sm text-gray-600">O MyDataMed organiza dados, agenda, documentos e pré-atendimento. A avaliação, conduta, prescrição e responsabilidade são sempre do profissional habilitado.</p>
          </Card>

          <div className="rounded-3xl bg-slate-950 text-white p-5">
            <p className="text-sm text-white/55">Publicado com</p>
            <p className="font-bold text-xl">MyDataMed</p>
            <p className="text-sm text-white/65 mt-2">Consultório digital, agenda, IA assistiva, cobrança, CRM e HealthWallet.</p>
            <Link href="/register" className="mt-4 inline-flex items-center gap-2 text-emerald-200 font-semibold">Criar minha página <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </aside>
      </section>
    </main>
  )
}

function whatsappUrl(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? `https://wa.me/55${digits}` : ''
}
function modeLabel(value: string) { return value === 'online' ? 'Online' : value === 'presencial' ? 'Presencial' : 'Online e presencial' }
function Tag({ icon: Icon, text }: any) { return <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/10 px-3 py-1"><Icon className="w-4 h-4" /> {text}</span> }
function Card({ title, icon: Icon, children }: any) { return <section className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5"><h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-emerald-700" /> {title}</h2>{children}</section> }
function PublicLink({ href, label, icon: Icon = ArrowRight }: any) { return <a href={href} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-3 font-semibold text-gray-800 hover:bg-emerald-50"><span>{label}</span><Icon className="w-4 h-4 text-emerald-700" /></a> }
