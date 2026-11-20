// Chạy các file supabase/migrations/*.sql theo thứ tự, mỗi file một lần.
// Dùng: npm run db:migrate   (cần DATABASE_URL trong .env.local)
import { config } from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

config({ path: '.env.local', quiet: true })

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Thiếu DATABASE_URL trong .env.local (xem README, mục Biến môi trường).')
  process.exit(1)
}

const dir = path.resolve('supabase/migrations')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
await client.query(`create table if not exists public._migrations (
  name text primary key, applied_at timestamptz not null default now())`)
await client.query('alter table public._migrations enable row level security')

const { rows } = await client.query('select name from public._migrations')
const done = new Set(rows.map((r) => r.name))

for (const f of files) {
  if (done.has(f)) { console.log(`· bỏ qua ${f} (đã chạy)`); continue }
  const sql = fs.readFileSync(path.join(dir, f), 'utf8')
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('insert into public._migrations (name) values ($1)', [f])
    await client.query('commit')
    console.log(`✓ ${f}`)
  } catch (e) {
    await client.query('rollback')
    console.error(`✗ ${f}: ${e.message}`)
    await client.end()
    process.exit(1)
  }
}
await client.end()
console.log('Xong.')
