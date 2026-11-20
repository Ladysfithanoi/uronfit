export type UserRole = 'fm' | 'pt' | 'client' | 'guardian'
export type Gender = 'female' | 'male'
export type GoalGroup = 'fat_loss' | 'weight_gain' | 'posture' | 'rehab' | 'kids'
export type TrainingType = 'one_on_one' | 'one_on_two' | 'kids_group'
export type ClientStatus = 'active' | 'paused' | 'ended'
export type PhaseStatus = 'planned' | 'active' | 'completed'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  email: string
  phone: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface Device {
  id: string
  user_id: string
  device_key: string
  label: string
  user_agent: string | null
  session_id: string | null
  first_seen: string
  last_seen: string
  revoked_at: string | null
}
