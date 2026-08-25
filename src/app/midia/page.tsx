'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Image, Loader2, Save, Upload } from 'lucide-react'

const fields = [
  { key: 'avatar_url', label: 'Foto / Avatar', folder: 'avatar' },
  { key: 'logo_url', label: 'Logo', folder: 'logo' },
  { key: 'cover_image_url', label: 'Capa', folder: 'cover' },
]

export default function MidiaPage() {
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState('')
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (user && professional) loadProfile()
  }, [user, professional])

  async function loadProfile() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('professional_public_profiles')
      .select('*')
      .eq('professional_user_id', user.id)
      .maybeSingle()
    if (error) toast.error('Rode SQL_MYDATAMED_OPS_BILLING_USAGE_V1.sql para ativar uploads.')
    setProfile(data || {})
    setLoading(false)
  }

  async function uploadAsset(field: string, folder: string, file?: File | null) {
    if (!user || !professional || !file) return
    if (!file.type.startsWith('image/')) return toast.error('Envie uma imagem')
    if (file.size > 5 * 1024 * 1024) return toast.error('Imagem até 5MB')

    setUploading(field)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/${folder}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('mydatamed-brand-assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('mydatamed-brand-assets').getPublicUrl(path)
      const publicUrl = data.publicUrl

      const payload = {
        professional_id: professional.id,
        professional_user_id: user.id,
        public_slug: profile?.public_slug || slugify([professional.full_name, professional.specialty].filter(Boolean).join(' ')),
        display_name: profile?.display_name || professional.full_name,
        professional_title: profile?.professional_title || labelForProfessional(professional.professional_type),
        specialty: profile?.specialty || professional.specialty || null,
        is_published: Boolean(profile?.is_published),
        [field]: publicUrl,
        metadata: { ...(profile?.metadata || {}), media_updated_from: 'midia_page' },
      }

      const { error } = await supabase.from('professional_public_profiles').upsert(payload, { onConflict: 'professional_user_id' })
      if (error) throw error

      try {
        await supabase.from('mydatamed_usage_events').insert({
          professional_id: professional.id,
          professional_user_id: user.id,
          event_type: 'storage_upload',
          quantity: 1,
          source: 'midia_page',
          description: `Upload de ${field}`,
          metadata: { path, field },
        })
      } catch {}

      toast.success('Imagem enviada')
      setProfile((current: any) => ({ ...current, [field]: publicUrl }))
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar imagem')
    } finally {
      setUploading('')
    }
  }

  if (authLoading || !professional || loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <section className="rounded-[2rem] bg-slate-950 text-white p-6 md:p-9">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-emerald-100 mb-5"><Image className="w-4 h-4" /> Mídia da página</div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight">Upload de foto, logo e capa.</h1>
        <p className="text-white/70 mt-4 text-lg max-w-3xl">Envie imagens para sua landing page/bio link. O arquivo fica no Storage público do MyDataMed e é aplicado automaticamente na sua página.</p>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {fields.map((item) => (
          <div key={item.key} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900">{item.label}</h2>
            <div className="aspect-square rounded-3xl bg-gray-50 border overflow-hidden flex items-center justify-center">
              {profile?.[item.key] ? <img src={profile[item.key]} alt={item.label} className="w-full h-full object-cover" /> : <Image className="w-10 h-10 text-gray-300" />}
            </div>
            <label className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white px-4 py-3 font-semibold cursor-pointer">
              {uploading === item.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Enviar imagem
              <input type="file" accept="image/*" hidden onChange={(e) => uploadAsset(item.key, item.folder, e.target.files?.[0])} />
            </label>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-emerald-50 border border-emerald-100 p-5 text-emerald-950 flex gap-3">
        <Save className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">Depois do upload, abra <strong>Minha Página</strong> para revisar textos, serviços e publicar o link.</p>
      </section>
    </main>
  )
}

function slugify(value: string) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}
function labelForProfessional(type: string) {
  return ({ medico: 'Médico(a)', nutricionista: 'Nutricionista', fisioterapeuta: 'Fisioterapeuta', psicologo: 'Psicólogo(a)', odonto: 'Dentista' } as any)[type] || 'Profissional de saúde'
}
