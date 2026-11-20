export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-caps mb-1">{eyebrow}</p>}
        <h1 className="text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/** Màn hình của module sẽ làm ở bước sau trong lộ trình build */
export function ComingSoon({ title, step, what }: { title: string; step: number; what: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <p className="label-caps text-brand">Bước {step}</p>
        <p className="mt-2 text-sm text-muted-foreground">{what}</p>
      </div>
    </>
  )
}
