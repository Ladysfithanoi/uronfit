'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMAIL_KEY = 'urgym-last-email'

export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(notice ?? null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  // Điền sẵn email lần trước — chỉ đọc được localStorage sau khi hydrate xong
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setEmail(localStorage.getItem(EMAIL_KEY) ?? '') } catch { /* chế độ riêng tư */ }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error)
        if (json.retryAfter) { setCooldown(json.retryAfter); setStep('code') }
        return
      }
      try { localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase()) } catch { /* bỏ qua */ }
      setInfo(json.message)
      setStep('code'); setCode(''); setCooldown(60)
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch {
      setError('Không kết nối được. Vui lòng kiểm tra mạng và thử lại.')
    } finally { setBusy(false) }
  }

  async function verify(value = code) {
    if (value.length < 6) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: value }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setCode(''); codeRef.current?.focus(); return }
      router.replace(json.redirect)
      router.refresh()
    } catch {
      setError('Không kết nối được. Vui lòng kiểm tra mạng và thử lại.')
    } finally { setBusy(false) }
  }

  if (step === 'email') {
    return (
      <form onSubmit={requestCode} className="space-y-4">
        {info && <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{info}</p>}
        <div className="space-y-2">
          <Label htmlFor="email" className="label-caps">Email</Label>
          <Input id="email" type="email" inputMode="email" autoComplete="email" required
            placeholder="ban@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !email}>
          <Mail /> {busy ? 'Đang gửi…' : 'Gửi mã đăng nhập'}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); verify() }} className="space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Email: <span className="font-semibold text-foreground">{email}</span>
      </p>
      {info && <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">{info}</p>}
      <p className="text-center text-sm text-muted-foreground">
        Nhập mã 6 số trong email <b className="text-foreground">mới nhất</b> — mỗi lần gửi lại, mã cũ sẽ hết hiệu lực.
      </p>
      <div className="space-y-2">
        <Label htmlFor="code" className="label-caps">Mã đăng nhập</Label>
        <Input id="code" ref={codeRef} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          placeholder="••••••" value={code}
          className="h-14 text-center text-2xl font-bold tracking-[0.5em]"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            setCode(v)
            if (v.length === 6) verify(v)
          }} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>
        {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
      </Button>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => { setStep('email'); setError(null) }}>
          <ArrowLeft /> Đổi email
        </Button>
        <Button type="button" variant="ghost" disabled={busy || cooldown > 0} onClick={() => requestCode()}>
          {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Không thấy email? Kiểm tra thư mục Spam hoặc Quảng cáo.
      </p>
    </form>
  )
}
