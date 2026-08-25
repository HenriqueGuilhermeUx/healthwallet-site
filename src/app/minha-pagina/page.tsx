'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { ArrowRight, CheckCircle, Copy, Eye, Globe2, Image, Link as LinkIcon, Loader2, Plus, Save, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react'

const reservedSlugs = new Set(['api', 'login', 'register', 'dashboard', 'consultorio', 'planos', 'tour', 'prefeituras', 'recepcao-digital', 'recepcao-autoatendimento', 'pre-atendimento', 'entrada-paciente', 'consulta-assistida', 'minha-pagina', 'backoffice', 'lgpd-consultorio', 'prescriptions', 'exam-requests'])

const emptyForm = {
  public_slug: '',
  profile_type: 'professional',
  is_published: false,
  display_name: '',
  professional_title: '',
  specialty: '',
  clinic_name: '',
  document_type: 'not_informed',
  document_number: '',
  commercial_name: '',
  headline: '',
  bio: '',
  patient_audience: '',
  service_mode: 'hybrid',
  city: '',
  state: '',
  address_summary: '',
  avatar_url: '',
  logo_url: '',
  cover_image_url: '',
  brand_color: '#059669',
  whatsapp: '',
  phone: '',
  email: '',
  instagram_url: '',
  website_url: '',
  booking_url: '',
  primary_cta_label: 'Agendar atendimento',
  primary_cta_url: '',
}

export default function MinhaPaginaPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(emptyForm)
  const [services, setServices] = useState<any[]>([])
  const [links, setLinks] = useState<any[]>([])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadProfile()
  }, [user, professional])

  const publicUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://mydatamed.com')
    return form.public_slug ? `${base.replace(/\/$/, '')}/${form.public_slug}` : ''
  }, [form.public_slug])

  function update(field: string, value: any) {
    if (field === 'public_slug') value = slugify(value)
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function suggestSlug() {
    const value = slugify([form.display_name || professional?.full_name, form.specialty || professional?.specialty].filter(Boolean).join(' '))
    update('public_slug', value)
  }

  async function loadProfile() {
    if (!user || !professional) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('professional_public_profiles')
        .select('*')
        .eq('professional_user_id', user.id)
        .maybeSingle()

      if (error) {
        toast.error('Rode SQL_MYDATAMED_COMMERCE_BACKOFFICE_V1.sql no Supabase para ativar Minha Página.')
      }

      const base = {
        ...emptyForm,
        display_name: professional.full_name || '',
        professional_title: labelForProfessional(professional.professional_type),
        specialty: professional.specialty || '',
        clinic_name: professional.professional_context?.clinic_name || '',
        document_type: 'cpf',
        document_number: professional.cpf || '',
        email: user.email || '',
        headline: headlineFor(professional),
        bio: professional.professional_context?.service_style || '',
        patient_audience: professional.professional_context?.patient_audience || '',
        public_slug: slugify([professional.full_name, professional.specialty].filter(Boolean).join(' ')),
      }

      setForm(data ? { ...base, ...data } : base)
      setServices(Array.isArray(data?.services) ? data.services : defaultServices(professional))
      setLinks(Array.isArray(data?.bio_links) ? data.bio_links : defaultLinks())
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    if (!user || !professional) return
    const slug = slugify(form.public_slug)
    if (!slug || slug.length < 3) {
      toast.error('Escolha um link público com pelo menos 3 caracteres')
      return
    }
    if (reservedSlugs.has(slug)) {
      toast.error('Esse link é reservado. Escolha outro slug.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        professional_id: professional.id,
        professional_user_id: user.id,
        public_slug: slug,
        profile_type: form.profile_type,
        is_published: Boolean(form.is_published),
        display_name: form.display_name || professional.full_name,
        professional_title: form.professional_title || labelForProfessional(professional.professional_type),
        specialty: form.specialty || professional.specialty || null,
        clinic_name: form.clinic_name || null,
        document_type: form.document_type || 'not_informed',
        document_number: onlyDigits(form.document_number),
        commercial_name: form.commercial_name || null,
        headline: form.headline || null,
        bio: form.bio || null,
        patient_audience: form.patient_audience || null,
        service_mode: form.service_mode || 'hybrid',
        city: form.city || null,
        state: form.state || null,
        address_summary: form.address_summary || null,
        avatar_url: form.avatar_url || null,
        logo_url: form.logo_url || null,
        cover_image_url: form.cover_image_url || null,
        brand_color: form.brand_color || '#059669',
        whatsapp: onlyDigits(form.whatsapp),
        phone: form.phone || null,
        email: form.email || user.email || null,
        instagram_url: form.instagram_url || null,
        website_url: form.website_url || null,
        booking_url: form.booking_url || null,
        primary_cta_label: form.primary_cta_label || 'Agendar atendimento',
        primary_cta_url: form.primary_cta_url || form.booking_url || whatsappUrl(form.whatsapp),
        services: services.filter((item) => item.title || item.description),
        bio_links: links.filter((item) => item.label || item.url),
        seo_title: `${form.display_name || professional.full_name} | MyDataMed`,
        seo_description: form.headline || form.bio || null,
        metadata: {
          source: 'minha_pagina_editor',
          updated_goal: 'landing_page_biolink_profissional',
        },
      }

      const { error } = await supabase
        .from('professional_public_profiles')
        .upsert(payload, { onConflict: 'professional_user_id' })

      if (error) throw error
      setForm((current: any) => ({ ...current, public_slug: slug }))
      toast.success('Página salva')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar página. Verifique se o slug já está em uso.')
    } finally {
      setSaving(false)
    }
  }

  async function copyUrl() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    toast.success('Link copiado')
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="absolute -right-14 -top-20 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1fr_0.9fr] gap-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><Sparkles className="w-4 h-4" /> Minha Página / BioLink</div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight">Monte sua página profissional em minutos.</h1>
            <p className="text-white/70 mt-4 text-lg">Logo, foto, bio, serviços, links, WhatsApp, agenda e dados comerciais para divulgar seu consultório digital.</p>
          </div>
          <div className="rounded-3xl bg-white text-gray-900 p-5 shadow-2xl">
            <p className="text-xs text-gray-500 mb-1">Seu link público</p>
            <div className="flex gap-2">
              <input value={publicUrl || 'Defina um slug'} readOnly className="flex-1 rounded-xl border bg-gray-50 px-3 py-3 text-sm" />
              <button onClick={copyUrl} className="rounded-xl bg-emerald-600 text-white px-4"><Copy className="w-5 h-5" /></button>
            </div>
            <div className="flex gap-2 mt-3">
              {publicUrl && <Link href={`/${form.public_slug}`} target="_blank" className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold"><Eye className="w-4 h-4" /> Ver</Link>}
              <button onClick={saveProfile} disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 text-white px-4 py-3 font-semibold disabled:opacity-60"><Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.9fr] gap-6">
        <div className="space-y-6">
          <Card title="Identidade e link" icon={Globe2}>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Slug público" value={form.public_slug} onChange={(v: string) => update('public_slug', v)} prefix="mydatamed.com/" />
              <button onClick={suggestSlug} className="mt-7 rounded-xl border px-4 py-3 font-semibold">Sugerir link</button>
              <Field label="Nome exibido" value={form.display_name} onChange={(v: string) => update('display_name', v)} />
              <Field label="Título profissional" value={form.professional_title} onChange={(v: string) => update('professional_title', v)} placeholder="Médico, Pediatra, Nutricionista..." />
              <Field label="Especialidade" value={form.specialty} onChange={(v: string) => update('specialty', v)} />
              <Field label="Clínica / nome comercial" value={form.clinic_name} onChange={(v: string) => update('clinic_name', v)} />
              <Select label="Página de" value={form.profile_type} onChange={(v: string) => update('profile_type', v)} options={[['professional', 'Profissional'], ['clinic', 'Clínica'], ['team', 'Equipe']]} />
              <Select label="Atendimento" value={form.service_mode} onChange={(v: string) => update('service_mode', v)} options={[['hybrid', 'Online e presencial'], ['online', 'Online'], ['presencial', 'Presencial']]} />
            </div>
            <Check label="Publicar página" checked={form.is_published} onChange={(v) => update('is_published', v)} />
          </Card>

          <Card title="Dados comerciais" icon={ShieldCheck}>
            <div className="grid md:grid-cols-3 gap-3">
              <Select label="Documento" value={form.document_type} onChange={(v: string) => update('document_type', v)} options={[['not_informed', 'Não informar'], ['cpf', 'CPF'], ['cnpj', 'CNPJ']]} />
              <Field label="Número" value={form.document_number} onChange={(v: string) => update('document_number', v)} placeholder="CPF/CNPJ" />
              <Field label="Razão/nome comercial" value={form.commercial_name} onChange={(v: string) => update('commercial_name', v)} />
              <Field label="Cidade" value={form.city} onChange={(v: string) => update('city', v)} />
              <Field label="UF" value={form.state} onChange={(v: string) => update('state', v.toUpperCase().slice(0, 2))} />
              <Field label="Endereço resumido" value={form.address_summary} onChange={(v: string) => update('address_summary', v)} />
            </div>
          </Card>

          <Card title="Comunicação" icon={UserRound}>
            <Field label="Headline" value={form.headline} onChange={(v: string) => update('headline', v)} placeholder="Ex: Atendimento pediátrico humanizado, online e presencial" />
            <Area label="Bio" value={form.bio} onChange={(v: string) => update('bio', v)} />
            <Field label="Público atendido" value={form.patient_audience} onChange={(v: string) => update('patient_audience', v)} />
          </Card>

          <Card title="Logo, fotos e visual" icon={Image}>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="URL da foto/avatar" value={form.avatar_url} onChange={(v: string) => update('avatar_url', v)} />
              <Field label="URL do logo" value={form.logo_url} onChange={(v: string) => update('logo_url', v)} />
              <Field label="URL da capa" value={form.cover_image_url} onChange={(v: string) => update('cover_image_url', v)} />
              <Field label="Cor principal" type="color" value={form.brand_color} onChange={(v: string) => update('brand_color', v)} />
            </div>
            <p className="text-xs text-gray-500 mt-2">Upload direto de imagem entra na próxima etapa; por enquanto já aceitamos URLs de logo/foto/capa.</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Contato e CTA" icon={LinkIcon}>
            <div className="grid gap-3">
              <Field label="WhatsApp" value={form.whatsapp} onChange={(v: string) => update('whatsapp', v)} />
              <Field label="E-mail" value={form.email} onChange={(v: string) => update('email', v)} />
              <Field label="Instagram" value={form.instagram_url} onChange={(v: string) => update('instagram_url', v)} placeholder="https://instagram.com/..." />
              <Field label="Site" value={form.website_url} onChange={(v: string) => update('website_url', v)} />
              <Field label="Link de agenda" value={form.booking_url} onChange={(v: string) => update('booking_url', v)} />
              <Field label="Texto do botão principal" value={form.primary_cta_label} onChange={(v: string) => update('primary_cta_label', v)} />
              <Field label="URL do botão principal" value={form.primary_cta_url} onChange={(v: string) => update('primary_cta_url', v)} />
            </div>
          </Card>

          <Card title="Serviços / pacotes visíveis" icon={Plus}>
            <div className="space-y-3">
              {services.map((service, index) => (
                <EditableItem key={index} item={service} onChange={(next: any) => setServices(services.map((s, i) => i === index ? next : s))} onRemove={() => setServices(services.filter((_, i) => i !== index))} />
              ))}
              <button onClick={() => setServices([...services, { title: '', description: '', price: '' }])} className="w-full rounded-xl border border-dashed px-4 py-3 font-semibold text-emerald-700">Adicionar serviço</button>
            </div>
          </Card>

          <Card title="Bio links" icon={LinkIcon}>
            <div className="space-y-3">
              {links.map((link, index) => (
                <EditableLink key={index} item={link} onChange={(next: any) => setLinks(links.map((s, i) => i === index ? next : s))} onRemove={() => setLinks(links.filter((_, i) => i !== index))} />
              ))}
              <button onClick={() => setLinks([...links, { label: '', url: '' }])} className="w-full rounded-xl border border-dashed px-4 py-3 font-semibold text-emerald-700">Adicionar link</button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  )
}

function slugify(value: string) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60)
}
function onlyDigits(value: string) { return String(value || '').replace(/\D/g, '') }
function whatsappUrl(value: string) { const digits = onlyDigits(value); return digits ? `https://wa.me/55${digits}` : '' }
function labelForProfessional(type: string) { return ({ medico: 'Médico(a)', nutricionista: 'Nutricionista', fisioterapeuta: 'Fisioterapeuta', psicologo: 'Psicólogo(a)', odonto: 'Dentista' } as any)[type] || 'Profissional de saúde' }
function headlineFor(professional: any) { return `${labelForProfessional(professional.professional_type)}${professional.specialty ? ` • ${professional.specialty}` : ''}` }
function defaultServices(professional: any) { return [{ title: 'Consulta', description: professional?.specialty || 'Atendimento em saúde', price: '' }] }
function defaultLinks() { return [{ label: 'Agendar atendimento', url: '' }, { label: 'Falar no WhatsApp', url: '' }] }

function Card({ title, icon: Icon, children }: any) { return <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5"><h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-emerald-700" /> {title}</h2>{children}</section> }
function Field({ label, value, onChange, type = 'text', placeholder = '', prefix = '' }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20">{prefix && <span className="bg-gray-50 px-3 py-3 text-sm text-gray-500 border-r">{prefix}</span>}<input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-3 text-sm outline-none" /></div></label> }
function Area({ label, value, onChange }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><textarea value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full min-h-[110px] rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" /></label> }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="text-sm font-semibold text-gray-700 mb-1 block">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">{options.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}</select></label> }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="mt-3 flex items-center gap-2 rounded-2xl bg-gray-50 border p-3 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> <span>{label}</span></label> }
function EditableItem({ item, onChange, onRemove }: any) { return <div className="rounded-2xl border bg-gray-50 p-3 space-y-2"><Field label="Nome" value={item.title} onChange={(v: string) => onChange({ ...item, title: v })} /><Field label="Descrição" value={item.description} onChange={(v: string) => onChange({ ...item, description: v })} /><Field label="Preço/texto" value={item.price} onChange={(v: string) => onChange({ ...item, price: v })} /><button onClick={onRemove} className="inline-flex items-center gap-1 text-sm text-red-700"><Trash2 className="w-4 h-4" /> Remover</button></div> }
function EditableLink({ item, onChange, onRemove }: any) { return <div className="rounded-2xl border bg-gray-50 p-3 space-y-2"><Field label="Texto" value={item.label} onChange={(v: string) => onChange({ ...item, label: v })} /><Field label="URL" value={item.url} onChange={(v: string) => onChange({ ...item, url: v })} /><button onClick={onRemove} className="inline-flex items-center gap-1 text-sm text-red-700"><Trash2 className="w-4 h-4" /> Remover</button></div> }
