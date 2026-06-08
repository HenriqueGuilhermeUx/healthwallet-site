'use client'

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

type Props = {
  signUrl: string
  onSigned?: () => void
  height?: number
}

/**
 * Embute a tela de assinatura da Clicksign via iframe.
 *
 * Clicksign envia o evento 'sign' para o parent via postMessage quando o médico
 * termina de assinar. O webhook do nosso lado (/api/clicksign/webhook) é quem
 * realmente atualiza o status no DB — o postMessage aqui é só pra dar feedback
 * imediato na UI.
 *
 * Alternativa: o script embed-js da Clicksign (new Clicksign(key).mount(...)).
 * iframe é mais robusto e isola CSS.
 */
export function ClicksignWidget({ signUrl, onSigned, height = 640 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      // Clicksign dispara mensagens com origem *.clicksign.com
      if (!event.origin.includes('clicksign.com')) return
      const data = (event.data || {}) as { event?: string; type?: string }
      const evt = data.event || data.type
      if (evt === 'sign' || evt === 'upload_done' || evt === 'completed') {
        onSigned?.()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onSigned])

  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-200 bg-white">
      <iframe
        ref={iframeRef}
        src={signUrl}
        className="w-full block"
        style={{ height: `${height}px`, border: 0 }}
        allow="clipboard-write"
        title="Assinatura digital Clicksign"
      />
    </div>
  )
}

export function SigningPlaceholder() {
  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white flex items-center justify-center" style={{ height: 240 }}>
      <div className="flex flex-col items-center gap-2 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Carregando tela de assinatura…</span>
      </div>
    </div>
  )
}
