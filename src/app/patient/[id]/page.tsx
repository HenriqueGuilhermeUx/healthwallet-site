'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  ArrowLeft,
  User,
  Activity,
  FileText,
  Pill,
  AlertTriangle,
  Heart,
  Brain,
  Sparkles,
  Send,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  Download
} from 'lucide-react'

interface PatientData {
  profile: any
  exams: any[]
  medications: any[]
  medscore: { score: number; level: string }
  allergies: string[]
  shareData?: any
}

interface AccessCode {
  id: string
  code: string
  patient_id: string
  permissions: any
  expires_at: string
  used_at: string | null
  created_at: string
}

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const { user, professional, loading: authLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [patientData, setPatientData] = useState<PatientData | null>(null)
  const [accessCode, setAccessCode] = useState<AccessCode | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('all')
  const [showSendDoc, setShowSendDoc] = useState(false)
  const [docTitle, setDocTitle] = useState('')
  const [docContent, setDocContent] = useState('')
  const [docType, setDocType] = useState('orientacao')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user && professional && resolvedParams.id) {
      loadPatientData()
    }
  }, [user, professional, resolvedParams.id])

  const loadPatientData = async () => {
    setLoading(true)

    try {
      // Load access code
      const { data: access } = await supabase
        .from('access_codes')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (!access) {
        toast.error('Acesso não encontrado')
        router.push('/dashboard')
        return
      }

      // Check if expired
      if (new Date(access.expires_at) < new Date()) {
        toast.error('Este acesso expirou')
        router.push('/dashboard')
        return
      }

      setAccessCode(access)

      // Load patient profile from localStorage (we'll simulate getting this data)
      // In production, this would come from an API that validates the access code
      const profileData = {
        birthDate: '1990-01-15',
        gender: 'female',
        weight: '65',
        height: '165',
        bloodType: 'A+',
        smokingStatus: 'never',
        alcoholConsumption: 'occasional',
        physicalActivity: 'moderate',
        sleepHours: '7',
        stressLevel: 'moderate',
        allergies: access.permissions?.allergies ? ['Penicilina'] : [],
        chronicConditions: access.permissions?.medications ? ['Hipertensão'] : [],
        medScore: 72,
      }

      // Simulated exam data
      const exams = access.permissions?.exams ? [
        {
          id: '1',
          file_name: 'Hemograma_2024.pdf',
          exam_type: 'hemograma',
          exam_date: '2024-01-15',
          laboratory: 'LabEx',
          ai_analysis: 'Resultados dentro dos parâmetros esperados.'
        },
        {
          id: '2',
          file_name: 'Perfil_Lipidico.pdf',
          exam_type: 'lipidico',
          exam_date: '2024-01-15',
          laboratory: 'LabEx',
          ai_analysis: 'LDL ligeiramente elevado. Recomenda-se dieta.'
        }
      ] : []

      // Simulated medications
      const medications = access.permissions?.medications ? [
        { id: '1', name: 'Losartana', dosage: '50mg', frequency: '1x ao dia' }
      ] : []

      setPatientData({
        profile: profileData,
        exams,
        medications,
        medscore: { score: profileData.medScore, level: 'Bom' },
        allergies: profileData.allergies,
      })

    } catch (err) {
      console.error('Error loading patient data:', err)
      toast.error('Erro ao carregar dados do paciente')
    } finally {
      setLoading(false)
    }
  }

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleSendDocument = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast.error('Preencha o título e o conteúdo')
      return
    }

    setSending(true)

    try {
      const { error } = await supabase.from('received_documents').insert({
        patient_id: accessCode?.patient_id,
        professional_id: professional?.id,
        document_type: docType,
        title: docTitle,
        content: docContent,
        sent_at: new Date().toISOString(),
      })

      if (error) throw error

      toast.success('Documento enviado com sucesso!')
      setShowSendDoc(false)
      setDocTitle('')
      setDocContent('')
    } catch (err) {
      toast.error('Erro ao enviar documento')
    } finally {
      setSending(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!patientData) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Dados não disponíveis</p>
        <button onClick={() => router.push('/dashboard')} className="mt-4 text-emerald-600">
          Voltar ao dashboard
        </button>
      </div>
    )
  }

  const profile = patientData.profile
  const permissions = accessCode?.permissions || {}

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dados do Paciente</h1>
          <p className="text-sm text-gray-500">Acesso expira em {accessCode ? new Date(accessCode.expires_at).toLocaleDateString('pt-BR') : ''}</p>
        </div>
      </div>

      {/* Patient Info */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Paciente</h2>
            <p className="opacity-80">
              {calculateAge(profile.birthDate)} anos • {profile.gender === 'male' ? 'Masculino' : 'Feminino'} • {profile.bloodType}
            </p>
          </div>
        </div>

        {permissions.medscore && (
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm opacity-80">MedScore</p>
                <p className="text-2xl font-bold">{patientData.medscore.score} - {patientData.medscore.level}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {/* Allergies */}
        {permissions.allergies && patientData.allergies.length > 0 && (
          <SectionCard
            title="Alergias"
            icon={AlertTriangle}
            color="red"
            expanded={expandedSection === 'allergies'}
            onToggle={() => toggleSection('allergies')}
          >
            <div className="flex flex-wrap gap-2">
              {patientData.allergies.map((allergy, idx) => (
                <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                  {allergy}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Exams */}
        {permissions.exams && patientData.exams.length > 0 && (
          <SectionCard
            title="Exames"
            icon={FileText}
            color="blue"
            expanded={expandedSection === 'exams'}
            onToggle={() => toggleSection('exams')}
          >
            <div className="space-y-4">
              {patientData.exams.map((exam) => (
                <div key={exam.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">
                        {exam.exam_type === 'hemograma' ? 'Hemograma Completo' :
                         exam.exam_type === 'lipidico' ? 'Perfil Lipídico' : exam.file_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(exam.exam_date).toLocaleDateString('pt-BR')} • {exam.laboratory}
                      </p>
                    </div>
                  </div>
                  {exam.ai_analysis && (
                    <div className="mt-3 p-3 bg-emerald-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Brain className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-800">Análise IA</span>
                      </div>
                      <p className="text-sm text-emerald-700">{exam.ai_analysis}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Medications */}
        {permissions.medications && patientData.medications.length > 0 && (
          <SectionCard
            title="Medicamentos em Uso"
            icon={Pill}
            color="orange"
            expanded={expandedSection === 'medications'}
            onToggle={() => toggleSection('medications')}
          >
            <div className="space-y-3">
              {patientData.medications.map((med) => (
                <div key={med.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <Pill className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-gray-900">{med.name} {med.dosage}</p>
                    <p className="text-sm text-gray-500">{med.frequency}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* AI Analysis */}
        {permissions.ai_analysis && (
          <SectionCard
            title="Análise de IA"
            icon={Sparkles}
            color="purple"
            expanded={expandedSection === 'ai'}
            onToggle={() => toggleSection('ai')}
          >
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-purple-800">
                Análise inteligente baseada nos dados disponíveis. Recomenda-se avaliação cardiológica
                considerando o histórico familiar e níveis de colesterol.
              </p>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {professional?.professional_type === 'medico' && (
          <Link
            href={`/prescriptions/new?patientId=${accessCode?.patient_id}`}
            className="py-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            Criar Receita Digital
          </Link>
        )}
        <button
          onClick={() => setShowSendDoc(true)}
          className="py-4 rounded-xl bg-white border-2 border-emerald-600 text-emerald-700 font-semibold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          Enviar Documento/Orientação
        </button>
      </div>

      {/* Send Document Modal */}
      {showSendDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Enviar Documento</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Documento</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none"
                >
                  <option value="orientacao">Orientação</option>
                  <option value="evolucao">Evolução</option>
                  <option value="atestado">Atestado</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Ex: Orientação pós-consulta"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conteúdo</label>
                <textarea
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Digite o conteúdo do documento..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSendDoc(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendDocument}
                disabled={sending}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending && <Loader2 className="w-5 h-5 animate-spin" />}
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  color,
  expanded,
  onToggle,
  children
}: {
  title: string
  icon: any
  color: 'blue' | 'red' | 'orange' | 'purple' | 'green'
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const colors = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    green: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colors[color].bg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${colors[color].text}`} />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}
