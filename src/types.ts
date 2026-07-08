export type UserRole = 'collector' | 'admin'

export type SyncStatus = 'draft_local' | 'pending_sync' | 'synced' | 'sync_error'

export type UserProfile = {
  id: string
  name: string
  username: string
  email: string
  role: UserRole
  active: boolean
}

export type Community = {
  id: string
  name: string
  municipality: string
  association: string
}

export type Stakeholder = {
  id: string
  name: string
  role: string
  contact: string
  influence: 'Alta' | 'Media' | 'Baixa'
}

export type PhotoRecord = {
  id: string
  category: string
  fileName: string
  gpsLat: number
  gpsLng: number
  takenAt: string
}

export type FormRecord = {
  id: string
  userId: string
  collectorName: string
  communityId: string
  communityName: string
  municipality: string
  association: string
  interviewee: string
  phone: string
  families: number
  inhabitants: number
  producers: number
  mainActivities: string
  crops: string
  incomeProfile: string
  energy: boolean
  water: string
  sanitation: string
  internet: string
  school: boolean
  healthUnit: boolean
  environmentalRisks: string
  companyRating: 'Excelente' | 'Bom' | 'Regular' | 'Ruim'
  demands: string
  opportunities: string
  observations: string
  status: 'Rascunho' | 'Finalizado'
  syncStatus: SyncStatus
  device: string
  appVersion: string
  gpsLat: number
  gpsLng: number
  gpsAccuracy: number
  collectedAt: string
  syncedAt?: string
  stakeholders: Stakeholder[]
  photos: PhotoRecord[]
}

export type DraftFormInput = {
  communityId: string
  communityName: string
  municipality: string
  association: string
  interviewee: string
  phone: string
  families: string
  inhabitants: string
  producers: string
  mainActivities: string
  crops: string
  incomeProfile: string
  energy: boolean
  water: string
  sanitation: string
  internet: string
  school: boolean
  healthUnit: boolean
  environmentalRisks: string
  companyRating: 'Excelente' | 'Bom' | 'Regular' | 'Ruim'
  demands: string
  opportunities: string
  observations: string
  photoCategory: string
  photoName: string
}
