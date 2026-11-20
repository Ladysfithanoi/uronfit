import { createClient } from '@/lib/supabase/server'
import { NotesClient } from './NotesClient'

export async function NotesTab({ clientId }: { clientId: string }) {
  const supabase = await createClient()
  const { data } = await supabase.from('notes')
    .select('id, content, coach_only, created_at, profiles(full_name)')
    .eq('client_id', clientId).order('created_at', { ascending: false })
  const notes = (data ?? []).map((n) => ({
    id: n.id, content: n.content, coach_only: n.coach_only, created_at: n.created_at,
    author: (n.profiles as unknown as { full_name: string } | null)?.full_name ?? '—',
  }))
  return <NotesClient clientId={clientId} notes={notes} />
}
