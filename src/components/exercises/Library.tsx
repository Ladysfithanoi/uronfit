'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ImageIcon, Plus, Search, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, ChipGroup } from '@/components/form/Field'
import { ExerciseDetail } from './ExerciseDetail'
import { Pager, usePaged, useScrollTop } from '@/components/ui/pagination'
import { confirmDialog } from '@/components/ui/app-dialog'
import { createClient } from '@/lib/supabase/client'
import { compressImage, randomFileName } from '@/lib/image'
import { EXERCISE_TAG_LABEL, HEALTH_FLAG_LABEL } from '@/lib/labels'
import { saveExercise, deleteExercise, type ExerciseInput } from '@/app/(app)/thu-vien/actions'

export type Exercise = {
  id: string; name: string; muscle_group: string | null; equipment: string | null; description: string | null
  image_path: string | null; image_url: string | null; video_url: string | null; tags: string[]; contraindications: string[]; created_by: string | null
}

export const normVi = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()

export function Library({ exercises, meId, isFm }: { exercises: Exercise[]; meId: string; isFm: boolean }) {
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equip, setEquip] = useState('')
  const [tag, setTag] = useState('')
  const [view, setView] = useState<Exercise | null>(null)
  const [edit, setEdit] = useState<{ id?: string; form: ExerciseInput } | null>(null)
  const muscles = useMemo(() => [...new Set(exercises.map((e) => e.muscle_group).filter(Boolean))].sort() as string[], [exercises])
  const equips = useMemo(() => [...new Set(exercises.map((e) => e.equipment).filter(Boolean))].sort() as string[], [exercises])

  const list = exercises.filter((e) => (!q || normVi(e.name).includes(normVi(q))) &&
    (!muscle || e.muscle_group === muscle) && (!equip || e.equipment === equip) && (!tag || e.tags.includes(tag)))
  const canEdit = (e: Exercise) => isFm || e.created_by === meId
  const paged = usePaged(list, 24, [q, muscle, equip, tag].join('|'))
  const { ref: topRef, scroll } = useScrollTop<HTMLParagraphElement>()

  return (
    <>
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Tìm bài tập" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm bài tập" />
          </div>
          <Button onClick={() => setEdit({ form: { name: '', muscle_group: '', equipment: '', description: '', video_url: '', image_path: null, tags: [], contraindications: [] } })}>
            <Plus /> <span className="hidden sm:inline">Thêm bài</span>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NativeSelect value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Nhóm cơ"><option value="">Nhóm cơ</option>{muscles.map((m) => <option key={m}>{m}</option>)}</NativeSelect>
          <NativeSelect value={equip} onChange={(e) => setEquip(e.target.value)} aria-label="Dụng cụ"><option value="">Dụng cụ</option>{equips.map((m) => <option key={m}>{m}</option>)}</NativeSelect>
          <NativeSelect value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Nhãn"><option value="">Nhãn</option>{Object.entries(EXERCISE_TAG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
        </div>
      </div>

      <p ref={topRef} className="label-caps mb-2 scroll-mt-20">{list.length} bài</p>
      <ul className="grid gap-2 md:grid-cols-2">
        {paged.pageItems.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => setView(e)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-secondary">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                {e.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={e.image_url} alt="" className="size-full object-cover" />
                  : e.video_url ? <Video className="size-5 text-brand" /> : <ImageIcon className="size-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[e.muscle_group, e.equipment].filter(Boolean).join(' · ')}</p>
              </div>
              {e.contraindications.length > 0 && <span className="text-[11px] font-semibold text-warning">CCĐ</span>}
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Không có bài phù hợp.</p>}
      <Pager paged={paged} label="bài" onChange={scroll} />

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.name}</DialogTitle></DialogHeader>
              <ExerciseDetail ex={view} />
              {canEdit(view) && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setEdit({ id: view.id, form: {
                    name: view.name, muscle_group: view.muscle_group ?? '', equipment: view.equipment ?? '', description: view.description ?? '',
                    video_url: view.video_url ?? '', image_path: view.image_path, tags: view.tags, contraindications: view.contraindications,
                  } }); setView(null) }}>Sửa bài</Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {edit && <ExerciseForm key={edit.id ?? 'new'} edit={edit} meId={meId} isFm={isFm} onClose={() => setEdit(null)} />}
    </>
  )
}

function ExerciseForm({ edit, meId, isFm, onClose }: { edit: { id?: string; form: ExerciseInput }; meId: string; isFm: boolean; onClose: () => void }) {
  const [f, setF] = useState(edit.form)
  const [file, setFile] = useState<File | null>(null)
  const [pending, start] = useTransition()

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            let image_path = f.image_path
            if (file) {
              try {
                const blob = await compressImage(file)
                image_path = `${meId}/${randomFileName()}`
                const { error } = await createClient().storage.from('exercise-media').upload(image_path, blob, { contentType: 'image/jpeg' })
                if (error) throw error
              } catch { toast.error('Không tải được ảnh.'); return }
            }
            const r = await saveExercise({ ...f, image_path }, edit.id)
            if (r.ok) { toast.success('Đã lưu bài tập.'); onClose() } else toast.error(r.error)
          })
        }}>
          <DialogHeader><DialogTitle>{edit.id ? 'Sửa bài tập' : 'Thêm bài tập'}</DialogTitle></DialogHeader>
          <Field label="Tên bài" htmlFor="ex-name"><Input id="ex-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 items-end gap-3">
            <Field label="Nhóm cơ" htmlFor="ex-muscle"><Input id="ex-muscle" value={f.muscle_group} onChange={(e) => setF({ ...f, muscle_group: e.target.value })} /></Field>
            <Field label="Dụng cụ" htmlFor="ex-equip"><Input id="ex-equip" value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value })} /></Field>
          </div>
          <Field label="Mô tả kỹ thuật" htmlFor="ex-desc"><Textarea id="ex-desc" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Link video YouTube" htmlFor="ex-video" hint="Dán link YouTube — video phát ngay trong app.">
            <Input id="ex-video" type="url" inputMode="url" placeholder="https://youtu.be/…" value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} />
          </Field>
          <Field label="Ảnh minh hoạ" htmlFor="ex-img" hint={f.image_path ? 'Đã có ảnh — chọn ảnh mới để thay.' : undefined}>
            <Input id="ex-img" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field label="Nhãn">
            <ChipGroup multiple options={Object.entries(EXERCISE_TAG_LABEL).map(([value, label]) => ({ value, label }))} value={f.tags} onChange={(v) => setF({ ...f, tags: v })} />
          </Field>
          <Field label="Chống chỉ định" hint="Thêm vào giáo án của khách có tiền sử vùng này sẽ hiện cảnh báo.">
            <ChipGroup multiple options={Object.entries(HEALTH_FLAG_LABEL).map(([value, label]) => ({ value, label }))} value={f.contraindications} onChange={(v) => setF({ ...f, contraindications: v })} />
          </Field>
          <DialogFooter className="gap-2">
            {edit.id && isFm && (
              <Button type="button" variant="destructive" disabled={pending} onClick={async () => {
                if (!(await confirmDialog({ title: `Xoá bài "${f.name}"?`, description: 'Bài đang được dùng trong giáo án sẽ không xoá được.', destructive: true }))) return
                start(async () => { const r = await deleteExercise(edit.id!); if (r.ok) { toast.success('Đã xoá.'); onClose() } else toast.error(r.error) })
              }}>Xoá</Button>
            )}
            <Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu bài tập'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
