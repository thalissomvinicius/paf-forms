import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { FormRecord, PhotoRecord, Stakeholder, UserProfile, UserRole } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseKey &&
    !supabaseKey.includes('cole_a_chave') &&
    !supabaseUrl.includes('SEU-PROJETO'),
)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null

type DbProfile = {
  id: string
  auth_user_id: string | null
  username: string
  name: string
  role: UserRole
  active: boolean
  temporary_password: boolean
  password_updated_at: string | null
  last_login_at: string | null
}

type DbCommunity = {
  id: string
  name: string
  municipality: string
  association: string | null
}

type DbPhoto = {
  id: string
  category: string
  file_name: string
  gps_lat: number | null
  gps_lng: number | null
  taken_at: string
}

type DbStakeholder = {
  id: string
  name: string
  role: string | null
  phone: string | null
  notes: string | null
}

type DbForm = {
  id: string
  external_code: string | null
  user_id: string
  collector_name: string
  community_id: string | null
  community_name: string
  municipality: string
  association: string | null
  interviewee: string | null
  phone: string | null
  families: number | null
  inhabitants: number | null
  producers: number | null
  main_activities: string | null
  crops: string | null
  income_profile: string | null
  energy: boolean | null
  water: string | null
  sanitation: string | null
  internet: string | null
  school: boolean | null
  health_unit: boolean | null
  environmental_risks: string | null
  company_rating: string | null
  demands: string | null
  opportunities: string | null
  observations: string | null
  status: 'draft' | 'finalized' | 'reviewed'
  sync_status: FormRecord['syncStatus']
  device_label: string | null
  app_version: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  collected_at: string
  synced_at: string | null
  photos?: DbPhoto[]
  stakeholders?: DbStakeholder[]
}

function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase nao configurado')
  }

  return supabase
}

export function usernameToAuthEmail(username: string) {
  return `${username.trim().toLowerCase()}@paf.local`
}

export async function signInWithUsernamePassword(username: string, password: string) {
  const client = getSupabase()
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password,
  })

  if (authError) {
    throw authError
  }

  const authUserId = authData.user?.id

  if (!authUserId) {
    throw new Error('Sessao do Supabase nao retornou usuario')
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('active', true)
    .single()

  if (profileError) {
    throw profileError
  }

  return mapProfileToUser(profile as DbProfile)
}

export async function signOutSupabase() {
  if (!supabase) {
    return
  }

  await supabase.auth.signOut()
}

export async function fetchSupabaseProfiles() {
  const client = getSupabase()
  const { data, error } = await client.from('profiles').select('*').order('name')

  if (error) {
    throw error
  }

  return (data as DbProfile[]).map(mapProfileToUser)
}

export async function fetchSupabaseCommunities() {
  const client = getSupabase()
  const { data, error } = await client.from('communities').select('id, name, municipality, association').order('name')

  if (error) {
    throw error
  }

  return (data as DbCommunity[]).map((item) => ({
    id: item.id,
    name: item.name,
    municipality: item.municipality,
    association: item.association ?? '',
  }))
}

export async function fetchSupabaseForms() {
  const client = getSupabase()
  const { data, error } = await client
    .from('forms')
    .select('*, photos(*), stakeholders(*)')
    .order('collected_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data as DbForm[]).map(mapFormToRecord)
}

export async function createSupabaseProfile(input: {
  name: string
  username: string
  role: UserRole
}) {
  const client = getSupabase()
  const { data, error } = await client
    .from('profiles')
    .insert({
      name: input.name,
      username: input.username,
      role: input.role,
      active: true,
      temporary_password: true,
      password_updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapProfileToUser(data as DbProfile)
}

export async function updateSupabaseProfile(
  id: string,
  patch: Partial<Pick<DbProfile, 'active' | 'role'>>,
) {
  const client = getSupabase()
  const { data, error } = await client.from('profiles').update(patch).eq('id', id).select('*').single()

  if (error) {
    throw error
  }

  return mapProfileToUser(data as DbProfile)
}

export async function syncFormToSupabase(record: FormRecord) {
  const client = getSupabase()
  const now = new Date().toISOString()
  const payload = {
    external_code: record.id,
    local_id: record.id,
    user_id: record.userId,
    collector_name: record.collectorName,
    community_id: record.communityId,
    community_name: record.communityName,
    municipality: record.municipality,
    association: record.association,
    interviewee: record.interviewee,
    phone: record.phone,
    families: record.families,
    inhabitants: record.inhabitants,
    producers: record.producers,
    main_activities: record.mainActivities,
    crops: record.crops,
    income_profile: record.incomeProfile,
    energy: record.energy,
    water: record.water,
    sanitation: record.sanitation,
    internet: record.internet,
    school: record.school,
    health_unit: record.healthUnit,
    environmental_risks: record.environmentalRisks,
    company_rating: record.companyRating,
    demands: record.demands,
    opportunities: record.opportunities,
    observations: record.observations,
    status: record.status === 'Rascunho' ? 'draft' : 'finalized',
    sync_status: 'synced',
    device_label: record.device,
    app_version: record.appVersion,
    gps_lat: record.gpsLat,
    gps_lng: record.gpsLng,
    gps_accuracy: record.gpsAccuracy,
    collected_at: record.collectedAt,
    synced_at: now,
    raw_payload: record,
  }

  const { data: form, error: formError } = await client
    .from('forms')
    .upsert(payload, { onConflict: 'external_code' })
    .select('*')
    .single()

  if (formError) {
    throw formError
  }

  if (record.photos.length > 0) {
    const photoRows = record.photos.map((photo) => ({
      form_id: form.id,
      category: photo.category,
      file_name: photo.fileName,
      gps_lat: photo.gpsLat,
      gps_lng: photo.gpsLng,
      taken_at: photo.takenAt,
    }))

    const { error: photoError } = await client.from('photos').insert(photoRows)

    if (photoError && photoError.code !== '23505') {
      throw photoError
    }
  }

  await client.from('sync_logs').insert({
    form_id: form.id,
    profile_id: record.userId,
    action: 'mobile_sync',
    status: 'synced',
    message: 'Coleta sincronizada pelo app de campo',
  })

  return {
    ...record,
    syncStatus: 'synced' as const,
    syncedAt: now,
  }
}

function mapProfileToUser(profile: DbProfile): UserProfile {
  return {
    id: profile.id,
    name: profile.name,
    username: profile.username,
    email: usernameToAuthEmail(profile.username),
    role: profile.role,
    active: profile.active,
  }
}

function mapFormToRecord(row: DbForm): FormRecord {
  return {
    id: row.external_code ?? row.id,
    userId: row.user_id,
    collectorName: row.collector_name,
    communityId: row.community_id ?? '',
    communityName: row.community_name,
    municipality: row.municipality,
    association: row.association ?? '',
    interviewee: row.interviewee ?? '',
    phone: row.phone ?? '',
    families: row.families ?? 0,
    inhabitants: row.inhabitants ?? 0,
    producers: row.producers ?? 0,
    mainActivities: row.main_activities ?? '',
    crops: row.crops ?? '',
    incomeProfile: row.income_profile ?? '',
    energy: Boolean(row.energy),
    water: row.water ?? '',
    sanitation: row.sanitation ?? '',
    internet: row.internet ?? '',
    school: Boolean(row.school),
    healthUnit: Boolean(row.health_unit),
    environmentalRisks: row.environmental_risks ?? '',
    companyRating: normalizeRating(row.company_rating),
    demands: row.demands ?? '',
    opportunities: row.opportunities ?? '',
    observations: row.observations ?? '',
    status: row.status === 'draft' ? 'Rascunho' : 'Finalizado',
    syncStatus: row.sync_status,
    device: row.device_label ?? 'Dispositivo nao informado',
    appVersion: row.app_version ?? '0.1.0',
    gpsLat: Number(row.gps_lat ?? 0),
    gpsLng: Number(row.gps_lng ?? 0),
    gpsAccuracy: row.gps_accuracy ?? 0,
    collectedAt: row.collected_at,
    syncedAt: row.synced_at ?? undefined,
    stakeholders: (row.stakeholders ?? []).map(mapStakeholder),
    photos: (row.photos ?? []).map(mapPhoto),
  }
}

function mapPhoto(photo: DbPhoto): PhotoRecord {
  return {
    id: photo.id,
    category: photo.category,
    fileName: photo.file_name,
    gpsLat: Number(photo.gps_lat ?? 0),
    gpsLng: Number(photo.gps_lng ?? 0),
    takenAt: photo.taken_at,
  }
}

function mapStakeholder(item: DbStakeholder): Stakeholder {
  return {
    id: item.id,
    name: item.name,
    role: item.role ?? '',
    contact: item.phone ?? '',
    influence: 'Media',
  }
}

function normalizeRating(value: string | null): FormRecord['companyRating'] {
  if (value === 'Excelente' || value === 'Bom' || value === 'Regular' || value === 'Ruim') {
    return value
  }

  return 'Bom'
}
