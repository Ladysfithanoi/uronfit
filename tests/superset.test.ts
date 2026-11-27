/** Superset: gom khối, chuẩn hoá chữ cái, làm sạch kết quả AI (không cần database) */
import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { clientExercises, normalizeGroups, supersetBlocks } from '@/lib/superset'
import { fixSupersets, sanitizePlan, type PlanExercise } from '@/lib/ai/workout'

const rows = (gs: (string | null)[]) => gs.map((g, i) => ({ id: `e${i}`, superset_group: g }))
const labels = (gs: (string | null)[]) => supersetBlocks(rows(gs)).flatMap((b) => b.items.map((x) => x.label))

describe('supersetBlocks', () => {
  it('không có superset → số 1, 2, 3', () => expect(labels([null, null, null])).toEqual(['1', '2', '3']))
  it('có superset → A, B1, B2, C', () => expect(labels([null, 'Q', 'Q', null])).toEqual(['A', 'B1', 'B2', 'C']))
  it('cùng chữ nhưng không liền nhau → bài đơn', () => expect(labels(['A', null, 'A'])).toEqual(['1', '2', '3']))
  it('đánh dấu bài cuối nhóm', () => expect(supersetBlocks(rows(['A', 'A', 'A']))[0].items.map((x) => x.last)).toEqual([false, false, true]))
})

describe('normalizeGroups', () => {
  it('đặt lại chữ theo thứ tự và bỏ nhóm còn 1 bài', () => {
    expect(normalizeGroups(rows(['*', '*', 'C', null, 'A', 'A']))).toEqual([
      { id: 'e0', superset_group: 'A' }, { id: 'e1', superset_group: 'A' }, { id: 'e2', superset_group: null },
      { id: 'e4', superset_group: 'B' }, { id: 'e5', superset_group: 'B' },
    ])
  })
  it('đã chuẩn → không đổi gì', () => expect(normalizeGroups(rows(['A', 'A', null, 'B', 'B']))).toEqual([]))
})

describe('clientExercises', () => {
  it('bài riêng thay bài chung và giữ nhóm superset', () => {
    const list = [
      { id: 'a', superset_group: 'A', client_id: null, replaces_id: null },
      { id: 'b', superset_group: 'A', client_id: null, replaces_id: null },
      { id: 'b2', superset_group: null, client_id: 'k1', replaces_id: 'b' },
    ]
    expect(clientExercises(list, 'k1').map((e) => [e.id, e.superset_group])).toEqual([['a', 'A'], ['b2', 'A']])
    expect(clientExercises(list, 'k2').map((e) => e.id)).toEqual(['a', 'b'])
  })
})

const ex = (superset: string | null, rest = 60, sets = 3): PlanExercise =>
  ({ exercise_id: 'x', name: 'x', sets, reps: '10', duration_sec: null, rest_sec: rest, note: null, superset })

describe('fixSupersets (kết quả AI)', () => {
  it('nhóm hợp lệ: bài trước không nghỉ quá 15s, cùng số hiệp', () => {
    const l = [ex(null, 90), ex('B', 60, 3), ex('B', 60, 4), ex(null, 5)]
    fixSupersets(l)
    expect(l.map((e) => e.superset)).toEqual([null, 'A', 'A', null])
    expect(l.map((e) => e.rest_sec)).toEqual([90, 15, 60, 15])
    expect(l[2].sets).toBe(3)
  })
  it('nhóm quá 4 bài hoặc chỉ 1 bài → bài đơn', () => {
    const l = [ex('A'), ex('A'), ex('A'), ex('A'), ex('A'), ex('C')]
    fixSupersets(l)
    expect(l.every((e) => e.superset === null)).toBe(true)
  })
  it('sanitizePlan: không cho superset thì bỏ hết', () => {
    const lib = new Map([['E1', { id: '1', name: 'a', muscle_group: null, equipment: null, tags: [], contraindications: [] }],
      ['E2', { id: '2', name: 'b', muscle_group: null, equipment: null, tags: [], contraindications: [] }]])
    const raw = { name: 'x', days: [{ label: 'B1', exercises: [{ ref: 'E1', sets: 3, reps: '10', duration_sec: 0, rest_sec: 0, note: '', superset: 'A' }, { ref: 'E2', sets: 3, reps: '10', duration_sec: 0, rest_sec: 60, note: '', superset: 'A' }] }] }
    expect(sanitizePlan(raw, lib, 1, true).days[0].exercises.map((e) => e.superset)).toEqual(['A', 'A'])
    expect(sanitizePlan(raw, lib, 1, false).days[0].exercises.map((e) => e.superset)).toEqual([null, null])
  })
})
