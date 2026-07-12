'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export type ProfessionalPlanStatus = 'free' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'blocked'

const PRO_FEATURES = [
  'teleconsultation',
  'google_calendar_meet',
  'crm_smartbots',
  'payments_nextgen_woovi',
  'professional_documents',
  'professional_signature',
  'commercial_dashboard',
]

function isFuture(value?: string | null) {
  if (!value) return true
  return new Date(value).getTime() > Date.now()
}

export function useProfessionalAccess() {
  const { user, professional, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<any>(null)
  const [features, setFeatures] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [user?.id, professional?.id])

  async function load() {
    if (authLoading) return

    if (!user || !professional) {
      setSubscription(null)
      setFeatures([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [{ data: sub, error: subError }, { data: featureRows, error: featureError }] = await Promise.all([
      supabase
        .from('professional_subscriptions')
        .select('*')
        .eq('professional_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('professional_feature_access')
        .select('*')
        .eq('professional_user_id', user.id),
    ])

    if (subError || featureError) {
      setError(subError?.message || featureError?.message || 'Erro ao carregar plano profissional')
    }

    setSubscription(sub || null)
    setFeatures(featureRows || [])
    setLoading(false)
  }

  const planStatus: ProfessionalPlanStatus = useMemo(() => {
    if (!subscription) return 'free'

    if (subscription.status === 'active' && isFuture(subscription.current_period_ends_at)) return 'active'
    if (subscription.status === 'trial' && isFuture(subscription.trial_ends_at || subscription.current_period_ends_at)) return 'trial'

    return (subscription.status || 'free') as ProfessionalPlanStatus
  }, [subscription])

  const isPro = planStatus === 'active' || planStatus === 'trial'
  const isActivePaid = planStatus === 'active'
  const isTrial = planStatus === 'trial'

  function hasAccess(featureKey: string) {
    if (featureKey === 'patient_data_access_free') return true

    const feature = features.find((item) => item.feature_key === featureKey)
    if (feature && feature.enabled && ['trial', 'pro', 'free'].includes(feature.access_level) && isFuture(feature.ends_at)) {
      return true
    }

    if (PRO_FEATURES.includes(featureKey)) return isPro
    return false
  }

  function daysLeft() {
    const end = subscription?.trial_ends_at || subscription?.current_period_ends_at
    if (!end) return null

    const diff = new Date(end).getTime() - Date.now()
    if (diff <= 0) return 0
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return {
    loading: authLoading || loading,
    error,
    subscription,
    features,
    planStatus,
    isPro,
    isTrial,
    isActivePaid,
    hasAccess,
    daysLeft: daysLeft(),
    reload: load,
  }
}
