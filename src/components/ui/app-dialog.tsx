'use client'

import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'

/**
 * Hộp thoại xác nhận / nhập liệu theo giao diện app, thay cho confirm() / prompt()
 * mặc định của trình duyệt. Gọi ở bất kỳ đâu phía client:
 *   if (await confirmDialog({ title: 'Xoá?', destructive: true })) …
 *   const name = await promptDialog({ title: 'Đổi tên', defaultValue: 'A' })
 * Cần <AppDialogHost /> gắn một lần trong layout gốc.
 */
type ConfirmOpts = { title: string; description?: string; confirmLabel?: string; destructive?: boolean }
type PromptOpts = { title: string; description?: string; label?: string; defaultValue?: string; type?: 'text' | 'date'; confirmLabel?: string; required?: boolean }
type Req =
  | ({ kind: 'confirm'; resolve: (v: boolean) => void } & ConfirmOpts)
  | ({ kind: 'prompt'; resolve: (v: string | null) => void } & PromptOpts)

let push: ((r: Req) => void) | null = null

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => (push ? push({ kind: 'confirm', resolve, ...opts }) : resolve(false)))
}
export function promptDialog(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => (push ? push({ kind: 'prompt', resolve, ...opts }) : resolve(null)))
}

export function AppDialogHost() {
  const [req, setReq] = useState<Req | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    push = (r) => { setReq(r); setValue(r.kind === 'prompt' ? r.defaultValue ?? '' : '') }
    return () => { push = null }
  }, [])

  function close(result: boolean) {
    if (!req) return
    if (req.kind === 'confirm') req.resolve(result)
    else req.resolve(result ? value : null)
    setReq(null)
  }

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && close(false)}>
      <DialogContent showCloseButton={false}>
        {req && (
          <form onSubmit={(e) => { e.preventDefault(); close(true) }} className="space-y-4">
            <DialogHeader className="pr-0">
              <DialogTitle className="flex items-center gap-2">
                {req.kind === 'confirm' && req.destructive && <TriangleAlert className="size-5 shrink-0 text-destructive" />}
                {req.title}
              </DialogTitle>
              {req.description && <DialogDescription className="whitespace-pre-line">{req.description}</DialogDescription>}
            </DialogHeader>
            {req.kind === 'prompt' && (
              <Field label={req.label ?? ''} htmlFor="app-dialog-input">
                <Input id="app-dialog-input" ref={inputRef} autoFocus type={req.type ?? 'text'} required={req.required}
                  value={value} onChange={(e) => setValue(e.target.value)} />
              </Field>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="secondary" onClick={() => close(false)}>Huỷ</Button>
              <Button type="submit" autoFocus={req.kind === 'confirm'}
                variant={req.kind === 'confirm' && req.destructive ? 'destructive' : 'default'}>
                {req.confirmLabel ?? (req.kind === 'confirm' ? (req.destructive ? 'Xoá' : 'Đồng ý') : 'Lưu')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
