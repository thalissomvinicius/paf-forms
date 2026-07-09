import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Camera,
  CheckCircle,
  Clock,
  CloudUpload,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  Home,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  Smartphone,
  Table2,
  User,
  Users,
  WifiOff,
} from 'lucide-react'
import './App.css'
import { communities, mockForms, users } from './data/mockData'
import {
  createSupabaseProfile,
  fetchSupabaseCommunities,
  fetchSupabaseForms,
  fetchSupabaseProfiles,
  isSupabaseConfigured,
  signInWithUsernamePassword,
  signOutSupabase,
  syncFormToSupabase,
  updateSupabaseProfile,
} from './lib/supabase'
import type { Community, DraftFormInput, FormRecord, SyncStatus, UserProfile } from './types'

const LOCAL_FORMS_KEY = 'paf-local-collections'
const ACCESS_USERS_KEY = 'paf-access-users'

type AccessProfile = UserProfile & {
  accessTarget: 'App mobile' | 'Dashboard web'
  lastLoginAt?: string
  password: string
  passwordStatus: 'Ativa' | 'Temporaria' | 'Expirada'
  passwordUpdatedAt: string
  temporaryPassword?: string
}

const emptyDraft: DraftFormInput = {
  communityId: communities[0].id,
  communityName: communities[0].name,
  municipality: communities[0].municipality,
  association: communities[0].association,
  interviewee: '',
  phone: '',
  families: '',
  inhabitants: '',
  producers: '',
  mainActivities: '',
  crops: '',
  incomeProfile: '1 a 2 salarios minimos',
  energy: true,
  water: '',
  sanitation: '',
  internet: '',
  school: false,
  healthUnit: false,
  environmentalRisks: '',
  companyRating: 'Bom',
  demands: '',
  opportunities: '',
  observations: '',
  photoCategory: 'Comunidade',
  photoName: '',
}

const formSteps = [
  {
    number: '1',
    title: 'Identificacao',
    description: 'Comunidade, entrevistado e numeros principais',
  },
  {
    number: '2',
    title: 'Producao',
    description: 'Atividades, culturas e infraestrutura',
  },
  {
    number: '3',
    title: 'Demandas',
    description: 'Avaliacao, demandas e oportunidades',
  },
  {
    number: '4',
    title: 'Fotos',
    description: 'Registro fotografico com GPS',
  },
]

function App() {
  const [accessUsers, setAccessUsers] = useState<AccessProfile[]>(loadAccessUsers)
  const [session, setSession] = useState<UserProfile | null>(null)

  useEffect(() => {
    window.localStorage.setItem(ACCESS_USERS_KEY, JSON.stringify(accessUsers))
  }, [accessUsers])

  const logout = () => {
    void signOutSupabase()
    setSession(null)
  }

  if (!session) {
    return <LoginScreen accessUsers={accessUsers} onLogin={setSession} />
  }

  return (
    <main className="app-shell">
      {session.role === 'collector' ? (
        <CollectorApp user={session} onLogout={logout} />
      ) : (
        <AdminDashboard
          accessUsers={accessUsers}
          onAccessUsersChange={setAccessUsers}
          user={session}
          onLogout={logout}
        />
      )}
    </main>
  )
}

function LoginScreen({
  accessUsers,
  onLogin,
}: {
  accessUsers: AccessProfile[]
  onLogin: (user: UserProfile) => void
}) {
  const firstCollector = accessUsers.find((item) => item.role === 'collector' && item.active)
  const firstAdmin = accessUsers.find((item) => item.role === 'admin' && item.active)
  const [username, setUsername] = useState(firstCollector?.username ?? '')
  const [password, setPassword] = useState('demo123')
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedUsername = username.trim().toLowerCase()

    if (isSupabaseConfigured) {
      setLoggingIn(true)
      setError('')

      try {
        const profile = await signInWithUsernamePassword(normalizedUsername, password)
        onLogin(profile)
      } catch {
        setError('Usuario ou senha invalido no Supabase')
      } finally {
        setLoggingIn(false)
      }

      return
    }

    const found = accessUsers.find((item) => item.username.toLowerCase() === normalizedUsername)

    if (!found || password !== found.password) {
      setError('Usuario ou senha invalido')
      return
    }

    if (!found.active) {
      setError('Usuario inativo')
      return
    }

    setError('')
    onLogin(found)
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-label="Acesso PAF">
        <img className="brand-logo" src="/logo-paf.png" alt="PAF Agricultura Familiar" />

        <div className="login-copy">
          <p className="eyebrow">Coleta de campo e dashboard administrativo</p>
          <h1>Entrar no PAF</h1>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            Usuario
            <input
              autoComplete="username"
              inputMode="text"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="ana, carlos, admin"
              value={username}
              disabled={loggingIn}
            />
          </label>

          <label>
            Senha
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
              disabled={loggingIn}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={loggingIn} type="submit">
            <Lock aria-hidden="true" size={18} />
            {loggingIn ? 'Entrando' : 'Entrar'}
          </button>
        </form>

        {!isSupabaseConfigured ? (
          <div className="demo-access" aria-label="Acessos de demonstracao">
            <button disabled={!firstCollector} type="button" onClick={() => firstCollector && onLogin(firstCollector)}>
              <Smartphone aria-hidden="true" size={18} />
              Coletor
            </button>
            <button disabled={!firstAdmin} type="button" onClick={() => firstAdmin && onLogin(firstAdmin)}>
              <Monitor aria-hidden="true" size={18} />
              Admin
            </button>
          </div>
        ) : null}

        <DevSignature />
      </section>
    </main>
  )
}

function CollectorApp({ user, onLogout }: { user: UserProfile; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'home' | 'form' | 'sync'>('home')
  const [formStep, setFormStep] = useState(0)
  const formSectionRef = useRef<HTMLElement | null>(null)
  const [availableCommunities, setAvailableCommunities] = useState<Community[]>(communities)
  const [draft, setDraft] = useState<DraftFormInput>(emptyDraft)
  const [collections, setCollections] = useState<FormRecord[]>(() => loadLocalForms(user))
  const [gps, setGps] = useState({
    lat: -2.5338,
    lng: -44.2977,
    accuracy: 18,
    label: 'Coordenada simulada',
  })
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    persistLocalForms(user, collections)
  }, [collections, user])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let cancelled = false

    const loadRemoteData = async () => {
      try {
        const [remoteCommunities, remoteForms] = await Promise.all([
          fetchSupabaseCommunities(),
          fetchSupabaseForms(),
        ])

        if (cancelled) {
          return
        }

        if (remoteCommunities.length > 0) {
          setAvailableCommunities(remoteCommunities)
          setDraft((current) => {
            if (remoteCommunities.some((item) => item.id === current.communityId)) {
              return current
            }

            return draftFromCommunity(remoteCommunities[0], current)
          })
        }

        setCollections(remoteForms)
      } catch (error) {
        console.error('Falha ao carregar dados do Supabase', error)
      }
    }

    void loadRemoteData()

    return () => {
      cancelled = true
    }
  }, [user.id])

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const ownCollections = useMemo(
    () => collections.filter((item) => item.userId === user.id),
    [collections, user.id],
  )

  const pendingCount = ownCollections.filter(
    (item) => item.syncStatus === 'pending_sync' || item.syncStatus === 'sync_error',
  ).length
  const syncedCount = ownCollections.filter((item) => item.syncStatus === 'synced').length
  const draftCount = ownCollections.filter((item) => item.syncStatus === 'draft_local').length
  const isLastFormStep = formStep === formSteps.length - 1

  const updateDraft = <K extends keyof DraftFormInput>(key: K, value: DraftFormInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const scrollFormToTop = () => {
    window.setTimeout(() => formSectionRef.current?.scrollIntoView({ block: 'start' }), 0)
  }

  const openTab = (tab: 'home' | 'form' | 'sync') => {
    setActiveTab(tab)
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0 }), 0)
  }

  const previousFormStep = () => {
    setFormStep((current) => Math.max(0, current - 1))
    scrollFormToTop()
  }

  const nextFormStep = () => {
    setFormStep((current) => Math.min(formSteps.length - 1, current + 1))
    scrollFormToTop()
  }

  const updateCommunity = (communityId: string) => {
    const community = availableCommunities.find((item) => item.id === communityId) ?? availableCommunities[0]
    setDraft((current) => ({
      ...current,
      communityId: community.id,
      communityName: community.name,
      municipality: community.municipality,
      association: community.association,
    }))
  }

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGps((current) => ({ ...current, label: 'GPS indisponivel no navegador' }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: Math.round(position.coords.accuracy),
          label: 'GPS capturado',
        })
      },
      () => {
        setGps((current) => ({ ...current, label: 'Permissao de GPS nao concedida' }))
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }

  const createRecord = (syncStatus: SyncStatus): FormRecord => {
    const now = new Date().toISOString()
    const status = syncStatus === 'draft_local' ? 'Rascunho' : 'Finalizado'
    const suffix = Math.floor(1000 + Math.random() * 8999)
    const photoName = draft.photoName.trim()

    return {
      id: `LOCAL-${suffix}`,
      userId: user.id,
      collectorName: user.name,
      communityId: draft.communityId,
      communityName: draft.communityName,
      municipality: draft.municipality,
      association: draft.association,
      interviewee: draft.interviewee || 'Entrevistado nao informado',
      phone: draft.phone,
      families: Number(draft.families) || 0,
      inhabitants: Number(draft.inhabitants) || 0,
      producers: Number(draft.producers) || 0,
      mainActivities: draft.mainActivities,
      crops: draft.crops,
      incomeProfile: draft.incomeProfile,
      energy: draft.energy,
      water: draft.water,
      sanitation: draft.sanitation,
      internet: draft.internet,
      school: draft.school,
      healthUnit: draft.healthUnit,
      environmentalRisks: draft.environmentalRisks,
      companyRating: draft.companyRating,
      demands: draft.demands,
      opportunities: draft.opportunities,
      observations: draft.observations,
      status,
      syncStatus,
      device: getDeviceLabel(),
      appVersion: '0.1.0',
      gpsLat: gps.lat,
      gpsLng: gps.lng,
      gpsAccuracy: gps.accuracy,
      collectedAt: now,
      syncedAt: syncStatus === 'synced' ? now : undefined,
      stakeholders: [],
      photos: photoName
        ? [
            {
              id: `PHOTO-${suffix}`,
              category: draft.photoCategory,
              fileName: photoName,
              gpsLat: gps.lat,
              gpsLng: gps.lng,
              takenAt: now,
            },
          ]
        : [],
    }
  }

  const saveDraft = () => {
    setCollections((current) => [createRecord('draft_local'), ...current])
    setDraft(emptyDraft)
    setFormStep(0)
    openTab('sync')
  }

  const finishForm = () => {
    setCollections((current) => [createRecord('pending_sync'), ...current])
    setDraft(emptyDraft)
    setFormStep(0)
    openTab('sync')
  }

  const syncPending = () => {
    if (isSupabaseConfigured) {
      setSyncing(true)

      void (async () => {
        const pending = collections.filter(
          (item) => item.syncStatus === 'pending_sync' || item.syncStatus === 'sync_error',
        )
        const synced = new Map<string, FormRecord>()

        for (const item of pending) {
          try {
            synced.set(item.id, await syncFormToSupabase(item))
          } catch (error) {
            console.error('Falha ao sincronizar coleta no Supabase', error)
            synced.set(item.id, { ...item, syncStatus: 'sync_error' })
          }
        }

        setCollections((current) => current.map((item) => synced.get(item.id) ?? item))
        setSyncing(false)
      })()

      return
    }

    setSyncing(true)
    window.setTimeout(() => {
      setCollections((current) =>
        current.map((item) =>
          item.userId === user.id &&
          (item.syncStatus === 'pending_sync' || item.syncStatus === 'sync_error')
            ? { ...item, syncStatus: 'synced', syncedAt: new Date().toISOString() }
            : item,
        ),
      )
      setSyncing(false)
    }, 900)
  }

  return (
    <section className="collector-layout">
      <header className="mobile-topbar">
        <div>
          <img src="/logo-paf.png" alt="PAF Agricultura Familiar" />
          <span>{user.name}</span>
        </div>
        <button className="icon-button" onClick={onLogout} title="Sair" type="button">
          <LogOut aria-hidden="true" size={19} />
        </button>
      </header>

      {activeTab === 'home' ? (
        <section className="field-home">
          <div className="home-hero">
            <div>
              <p className="eyebrow">App de campo</p>
              <h1>Bom trabalho, {firstName(user.name)}</h1>
              <span>
                <MapPin aria-hidden="true" size={15} />
                {gps.label}
              </span>
            </div>
            <button className="primary-button" onClick={() => openTab('form')} type="button">
              <Plus aria-hidden="true" size={20} />
              Nova coleta
            </button>
          </div>

          <div className="mobile-summary-grid">
            <article>
              <FileText aria-hidden="true" size={20} />
              <strong>{ownCollections.length}</strong>
              <span>coletas</span>
            </article>
            <article>
              <Clock aria-hidden="true" size={20} />
              <strong>{pendingCount}</strong>
              <span>pendentes</span>
            </article>
            <article>
              <CheckCircle aria-hidden="true" size={20} />
              <strong>{syncedCount}</strong>
              <span>enviadas</span>
            </article>
            <article>
              <Save aria-hidden="true" size={20} />
              <strong>{draftCount}</strong>
              <span>rascunhos</span>
            </article>
          </div>

          <div className="quick-actions">
            <button onClick={() => openTab('form')} type="button">
              <Plus aria-hidden="true" size={19} />
              Nova coleta
            </button>
            <button onClick={() => openTab('sync')} type="button">
              <CloudUpload aria-hidden="true" size={19} />
              Sincronizar
            </button>
            <button onClick={captureGps} type="button">
              <MapPin aria-hidden="true" size={19} />
              Capturar GPS
            </button>
          </div>

          <section className="mobile-section recent-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Recentes</p>
                <h2>Ultimas coletas</h2>
              </div>
              <button className="secondary-button compact" onClick={() => openTab('sync')} type="button">
                Ver fila
              </button>
            </div>
            <div className="collection-list">
              {ownCollections.slice(0, 4).map((item) => (
                <article className="collection-item" key={item.id}>
                  <div>
                    <strong>{item.communityName}</strong>
                    <span>{formatDateTime(item.collectedAt)} · {item.municipality}</span>
                  </div>
                  <StatusBadge status={item.syncStatus} />
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {activeTab === 'form' ? (
        <section className="mobile-section form-card" ref={formSectionRef}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nova coleta</p>
              <h2>Formulario socioeconomico</h2>
              <span className="gps-note">
                <MapPin aria-hidden="true" size={14} />
                {gps.label}: {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
              </span>
            </div>
            <button className="secondary-button compact" onClick={captureGps} type="button">
              <MapPin aria-hidden="true" size={17} />
              GPS
            </button>
          </div>

          <form className="field-form">
            <div className="wizard-progress" aria-label="Progresso do formulario">
              {formSteps.map((step, index) => (
                <button
                  aria-label={`Ir para etapa ${step.number}: ${step.title}`}
                  className={index === formStep ? 'active' : index < formStep ? 'done' : ''}
                  key={step.number}
                  onClick={() => setFormStep(index)}
                  type="button"
                >
                  <span>{step.number}</span>
                </button>
              ))}
            </div>

            <div className="wizard-step-heading">
              <span>Etapa {formSteps[formStep].number} de {formSteps.length}</span>
              <h3>{formSteps[formStep].title}</h3>
              <p>{formSteps[formStep].description}</p>
            </div>

            <div className="form-slider" aria-live="polite">
              <div className="form-slider-track">
                <section aria-hidden={formStep !== 0} className="form-slide" aria-label="Identificacao">
                  <div className="form-stage">
                    <span>1</span>
                    <div>
                      <strong>Identificacao</strong>
                      <p>Comunidade, entrevistado e numeros principais</p>
                    </div>
                  </div>

                  <label>
                    Comunidade
                    <select value={draft.communityId} onChange={(event) => updateCommunity(event.target.value)}>
                      {availableCommunities.map((community) => (
                        <option key={community.id} value={community.id}>
                          {community.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="two-columns">
                    <label>
                      Municipio
                      <input value={draft.municipality} onChange={(event) => updateDraft('municipality', event.target.value)} />
                    </label>
                    <label>
                      Associacao
                      <input value={draft.association} onChange={(event) => updateDraft('association', event.target.value)} />
                    </label>
                  </div>

                  <div className="two-columns">
                    <label>
                      Entrevistado
                      <input value={draft.interviewee} onChange={(event) => updateDraft('interviewee', event.target.value)} />
                    </label>
                    <label>
                      Telefone
                      <input inputMode="tel" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} />
                    </label>
                  </div>

                  <div className="three-columns">
                    <label>
                      Familias
                      <input inputMode="numeric" value={draft.families} onChange={(event) => updateDraft('families', event.target.value)} />
                    </label>
                    <label>
                      Habitantes
                      <input inputMode="numeric" value={draft.inhabitants} onChange={(event) => updateDraft('inhabitants', event.target.value)} />
                    </label>
                    <label>
                      Produtores
                      <input inputMode="numeric" value={draft.producers} onChange={(event) => updateDraft('producers', event.target.value)} />
                    </label>
                  </div>
                </section>

                <section aria-hidden={formStep !== 1} className="form-slide" aria-label="Producao e infraestrutura">
                  <div className="form-stage">
                    <span>2</span>
                    <div>
                      <strong>Producao e infraestrutura</strong>
                      <p>Atividades, culturas, agua, saneamento e conectividade</p>
                    </div>
                  </div>

                  <label>
                    Atividades economicas
                    <textarea value={draft.mainActivities} onChange={(event) => updateDraft('mainActivities', event.target.value)} />
                  </label>

                  <label>
                    Culturas predominantes
                    <input value={draft.crops} onChange={(event) => updateDraft('crops', event.target.value)} />
                  </label>

                  <div className="two-columns">
                    <label>
                      Agua
                      <input value={draft.water} onChange={(event) => updateDraft('water', event.target.value)} />
                    </label>
                    <label>
                      Saneamento
                      <input value={draft.sanitation} onChange={(event) => updateDraft('sanitation', event.target.value)} />
                    </label>
                  </div>

                  <label>
                    Internet e telefonia
                    <input value={draft.internet} onChange={(event) => updateDraft('internet', event.target.value)} />
                  </label>

                  <div className="check-row">
                    <label>
                      <input checked={draft.energy} onChange={(event) => updateDraft('energy', event.target.checked)} type="checkbox" />
                      Energia
                    </label>
                    <label>
                      <input checked={draft.school} onChange={(event) => updateDraft('school', event.target.checked)} type="checkbox" />
                      Escola
                    </label>
                    <label>
                      <input checked={draft.healthUnit} onChange={(event) => updateDraft('healthUnit', event.target.checked)} type="checkbox" />
                      UBS
                    </label>
                  </div>
                </section>

                <section aria-hidden={formStep !== 2} className="form-slide" aria-label="Avaliacao e demandas">
                  <div className="form-stage">
                    <span>3</span>
                    <div>
                      <strong>Avaliacao e demandas</strong>
                      <p>Relacionamento, oportunidades e observacoes</p>
                    </div>
                  </div>

                  <div className="two-columns">
                    <label>
                      Avaliacao
                      <select
                        value={draft.companyRating}
                        onChange={(event) =>
                          updateDraft('companyRating', event.target.value as DraftFormInput['companyRating'])
                        }
                      >
                        <option>Excelente</option>
                        <option>Bom</option>
                        <option>Regular</option>
                        <option>Ruim</option>
                      </select>
                    </label>
                    <label>
                      Renda predominante
                      <input value={draft.incomeProfile} onChange={(event) => updateDraft('incomeProfile', event.target.value)} />
                    </label>
                  </div>

                  <label>
                    Demandas
                    <textarea value={draft.demands} onChange={(event) => updateDraft('demands', event.target.value)} />
                  </label>

                  <label>
                    Oportunidades
                    <textarea value={draft.opportunities} onChange={(event) => updateDraft('opportunities', event.target.value)} />
                  </label>

                  <label>
                    Observacoes
                    <textarea value={draft.observations} onChange={(event) => updateDraft('observations', event.target.value)} />
                  </label>
                </section>

                <section aria-hidden={formStep !== 3} className="form-slide" aria-label="Registro fotografico">
                  <div className="form-stage">
                    <span>4</span>
                    <div>
                      <strong>Registro fotografico</strong>
                      <p>Foto vinculada ao GPS atual da coleta</p>
                    </div>
                  </div>

                  <div className="photo-row">
                    <label>
                      Tipo de foto
                      <select value={draft.photoCategory} onChange={(event) => updateDraft('photoCategory', event.target.value)}>
                        <option>Comunidade</option>
                        <option>Infraestrutura</option>
                        <option>Areas produtivas</option>
                        <option>Liderancas</option>
                      </select>
                    </label>
                    <label className="file-input">
                      <Camera aria-hidden="true" size={18} />
                      <span>{draft.photoName || 'Adicionar foto'}</span>
                      <input
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => updateDraft('photoName', event.target.files?.[0]?.name ?? '')}
                        type="file"
                      />
                    </label>
                  </div>

                  <div className="photo-gps-card">
                    <MapPin aria-hidden="true" size={18} />
                    <div>
                      <strong>GPS do registro</strong>
                      <span>{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)} · precisao {gps.accuracy}m</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className={`wizard-actions ${isLastFormStep ? 'final' : ''}`}>
              <button className="secondary-button" disabled={formStep === 0} onClick={previousFormStep} type="button">
                Voltar
              </button>

              {isLastFormStep ? (
                <>
                  <button className="secondary-button" onClick={saveDraft} type="button">
                    <Save aria-hidden="true" size={18} />
                    Rascunho
                  </button>
                  <button className="primary-button" onClick={finishForm} type="button">
                    <Send aria-hidden="true" size={18} />
                    Finalizar
                  </button>
                </>
              ) : (
                <button className="primary-button wizard-next" onClick={nextFormStep} type="button">
                  Avancar
                </button>
              )}
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === 'sync' ? (
        <section className="sync-tab-content">
          <div className="mobile-status-grid">
            <StatusTile icon={<WifiOff size={18} />} label={online ? 'Online' : 'Offline'} value="Conexao" />
            <StatusTile icon={<Clock size={18} />} label={`${pendingCount} pendentes`} value="Fila de envio" />
            <StatusTile icon={<FileText size={18} />} label={`${ownCollections.length} no aparelho`} value="Coletas locais" />
          </div>

          <section className="mobile-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sincronizacao</p>
                <h2>Fila do aparelho</h2>
              </div>
              <button className="secondary-button compact" disabled={syncing || pendingCount === 0} onClick={syncPending} type="button">
                <RefreshCw aria-hidden="true" size={17} />
                {syncing ? 'Enviando' : 'Sincronizar'}
              </button>
            </div>

            <div className="sync-details">
              <span>
                <Smartphone aria-hidden="true" size={16} />
                {getDeviceLabel()}
              </span>
              <span>
                <MapPin aria-hidden="true" size={16} />
                Ultimo GPS: {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
              </span>
            </div>

            <div className="collection-list">
              {ownCollections.map((item) => (
                <article className="collection-item" key={item.id}>
                  <div>
                    <strong>{item.communityName}</strong>
                    <span>{formatDateTime(item.collectedAt)} · {item.device}</span>
                    {item.syncedAt ? <span>Enviado em {formatDateTime(item.syncedAt)}</span> : null}
                  </div>
                  <div className="collection-actions">
                    <StatusBadge status={item.syncStatus} />
                    <button className="pdf-button" onClick={() => void generateCollectionPdf(item)} type="button">
                      <Download aria-hidden="true" size={15} />
                      PDF
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      <DevSignature className="mobile-dev-signature" />

      <nav className="mobile-bottom-nav" aria-label="Navegacao do aplicativo de campo">
        <button
          aria-label="Inicio"
          aria-pressed={activeTab === 'home'}
          className={activeTab === 'home' ? 'active' : ''}
          onClick={() => openTab('home')}
          type="button"
        >
          <Home aria-hidden="true" size={20} />
          Inicio
        </button>
        <button
          aria-label="Coleta"
          aria-pressed={activeTab === 'form'}
          className={activeTab === 'form' ? 'active' : ''}
          onClick={() => openTab('form')}
          type="button"
        >
          <FileText aria-hidden="true" size={20} />
          Coleta
        </button>
        <button
          aria-label="Sincronizacao"
          aria-pressed={activeTab === 'sync'}
          className={activeTab === 'sync' ? 'active' : ''}
          onClick={() => openTab('sync')}
          type="button"
        >
          <CloudUpload aria-hidden="true" size={20} />
          Sinc
          {pendingCount > 0 ? <strong>{pendingCount}</strong> : null}
        </button>
      </nav>
    </section>
  )
}

function AdminDashboard({
  accessUsers,
  onAccessUsersChange,
  user,
  onLogout,
}: {
  accessUsers: AccessProfile[]
  onAccessUsersChange: React.Dispatch<React.SetStateAction<AccessProfile[]>>
  user: UserProfile
  onLogout: () => void
}) {
  const [query, setQuery] = useState('')
  const [community, setCommunity] = useState('Todas')
  const [collector, setCollector] = useState('Todos')
  const [status, setStatus] = useState('Todos')
  const [accessMessage, setAccessMessage] = useState('')
  const [dashboardForms, setDashboardForms] = useState<FormRecord[]>(mockForms)
  const [dashboardCommunities, setDashboardCommunities] = useState<Community[]>(communities)
  const [remoteAccessUsers, setRemoteAccessUsers] = useState<AccessProfile[] | null>(null)
  const [newAccess, setNewAccess] = useState({
    name: '',
    username: '',
    role: 'collector' as UserProfile['role'],
  })

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    let cancelled = false

    const loadDashboardData = async () => {
      try {
        const [remoteForms, remoteCommunities, remoteProfiles] = await Promise.all([
          fetchSupabaseForms(),
          fetchSupabaseCommunities(),
          fetchSupabaseProfiles(),
        ])

        if (cancelled) {
          return
        }

        setDashboardForms(remoteForms)
        setDashboardCommunities(remoteCommunities)
        setRemoteAccessUsers(remoteProfiles.map(accessProfileFromUserProfile))
      } catch (error) {
        console.error('Falha ao carregar dashboard do Supabase', error)
        setAccessMessage('Nao foi possivel carregar dados do Supabase')
      }
    }

    void loadDashboardData()

    return () => {
      cancelled = true
    }
  }, [])

  const displayAccessUsers = remoteAccessUsers ?? accessUsers
  const updateDisplayAccessUsers: React.Dispatch<React.SetStateAction<AccessProfile[]>> = (next) => {
    if (remoteAccessUsers) {
      setRemoteAccessUsers((current) =>
        typeof next === 'function' ? next(current ?? []) : next,
      )
      return
    }

    onAccessUsersChange(next)
  }
  const collectors = displayAccessUsers.filter((item) => item.role === 'collector')
  const accessStats = useMemo(
    () => ({
      mobile: displayAccessUsers.filter((item) => item.role === 'collector').length,
      dashboard: displayAccessUsers.filter((item) => item.role === 'admin').length,
      active: displayAccessUsers.filter((item) => item.active).length,
      temporaryPasswords: displayAccessUsers.filter((item) => item.passwordStatus === 'Temporaria').length,
    }),
    [displayAccessUsers],
  )

  const filteredForms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return dashboardForms.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        [item.communityName, item.collectorName, item.municipality, item.association]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesCommunity = community === 'Todas' || item.communityName === community
      const matchesCollector = collector === 'Todos' || item.collectorName === collector
      const matchesStatus = status === 'Todos' || item.syncStatus === status

      return matchesQuery && matchesCommunity && matchesCollector && matchesStatus
    })
  }, [collector, community, dashboardForms, query, status])

  const metrics = useMemo(() => {
    const photos = filteredForms.reduce((sum, item) => sum + item.photos.length, 0)
    const families = filteredForms.reduce((sum, item) => sum + item.families, 0)
    const synced = filteredForms.filter((item) => item.syncStatus === 'synced').length
    const pending = filteredForms.filter((item) => item.syncStatus !== 'synced').length

    return { photos, families, synced, pending, total: filteredForms.length }
  }, [filteredForms])

  const communityBars = useMemo(() => {
    return dashboardCommunities.map((item) => ({
      name: item.name,
      count: filteredForms.filter((form) => form.communityId === item.id).length,
    }))
  }, [dashboardCommunities, filteredForms])

  const maxCommunityCount = Math.max(...communityBars.map((item) => item.count), 1)

  const updateAccessUser = (id: string, patch: Partial<AccessProfile>) => {
    updateDisplayAccessUsers((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item
        }

        const nextRole = patch.role ?? item.role

        return {
          ...item,
          ...patch,
          accessTarget: accessTargetForRole(nextRole),
        }
      }),
    )

    if (isSupabaseConfigured && (patch.role || typeof patch.active === 'boolean')) {
      const supabasePatch: Partial<Pick<AccessProfile, 'active' | 'role'>> = {}

      if (patch.role) {
        supabasePatch.role = patch.role
      }

      if (typeof patch.active === 'boolean') {
        supabasePatch.active = patch.active
      }

      void updateSupabaseProfile(id, supabasePatch).catch((error) => {
        console.error('Falha ao atualizar perfil no Supabase', error)
        setAccessMessage('Nao foi possivel atualizar o perfil no Supabase')
      })
    }
  }

  const createAccessUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedUsername = normalizeUsername(newAccess.username)

    if (!newAccess.name.trim() || !normalizedUsername) {
      setAccessMessage('Informe nome e usuario para criar o acesso')
      return
    }

    if (displayAccessUsers.some((item) => item.username.toLowerCase() === normalizedUsername)) {
      setAccessMessage('Ja existe acesso com esse usuario')
      return
    }

    if (isSupabaseConfigured) {
      try {
        const profile = await createSupabaseProfile({
          name: newAccess.name.trim(),
          username: normalizedUsername,
          role: newAccess.role,
        })
        const createdUser = accessProfileFromUserProfile(profile)

        updateDisplayAccessUsers((current) => [...current, createdUser])
        setAccessMessage(
          `Perfil criado no Supabase. Crie o usuario Auth ${normalizedUsername}@paf.local e vincule em profiles.auth_user_id.`,
        )
        setNewAccess({ name: '', username: '', role: 'collector' })
      } catch (error) {
        console.error('Falha ao criar perfil no Supabase', error)
        setAccessMessage('Nao foi possivel criar o perfil no Supabase')
      }

      return
    }

    const temporaryPassword = generateTemporaryPassword()
    const createdUser: AccessProfile = {
      id: `user-${Date.now()}`,
      name: newAccess.name.trim(),
      username: normalizedUsername,
      email: `${normalizedUsername}@paf.local`,
      role: newAccess.role,
      active: true,
      accessTarget: accessTargetForRole(newAccess.role),
      password: temporaryPassword,
      passwordStatus: 'Temporaria',
      passwordUpdatedAt: new Date().toISOString(),
      temporaryPassword,
    }

    updateDisplayAccessUsers((current) => [...current, createdUser])
    setAccessMessage(`Senha temporaria de ${createdUser.name}: ${temporaryPassword}`)
    setNewAccess({ name: '', username: '', role: 'collector' })
  }

  const resetPassword = (id: string) => {
    if (isSupabaseConfigured) {
      const targetUser = displayAccessUsers.find((item) => item.id === id)
      setAccessMessage(
        `Reset real de senha deve ser feito no Supabase Auth para ${targetUser?.username ?? 'usuario'}@paf.local.`,
      )
      return
    }

    const temporaryPassword = generateTemporaryPassword()
    const targetUser = displayAccessUsers.find((item) => item.id === id)

    updateAccessUser(id, {
      password: temporaryPassword,
      passwordStatus: 'Temporaria',
      passwordUpdatedAt: new Date().toISOString(),
      temporaryPassword,
    })

    setAccessMessage(`Senha temporaria de ${targetUser?.name ?? 'usuario'}: ${temporaryPassword}`)
  }

  const downloadCsv = () => {
    const headers = [
      'id',
      'comunidade',
      'municipio',
      'coletor',
      'familias',
      'produtores',
      'status_sync',
      'data_coleta',
      'latitude',
      'longitude',
    ]
    const rows = filteredForms.map((item) => [
      item.id,
      item.communityName,
      item.municipality,
      item.collectorName,
      item.families,
      item.producers,
      syncLabel(item.syncStatus),
      formatDateTime(item.collectedAt),
      item.gpsLat,
      item.gpsLng,
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'paf-coletas.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <img className="dashboard-brand-logo" src="/logo-vilanova.png" alt="Vila Nova Agroindustrial" />
        <nav aria-label="Navegacao administrativa">
          <span>Analise</span>
          <a href="#indicadores">
            <BarChart3 aria-hidden="true" size={18} />
            Indicadores
          </a>
          <a href="#mapa">
            <MapPin aria-hidden="true" size={18} />
            Mapa
          </a>
          <a href="#registros">
            <Table2 aria-hidden="true" size={18} />
            Registros
          </a>
          <a href="#coletores">
            <Users aria-hidden="true" size={18} />
            Coletores
          </a>
          <span>Gestao</span>
          <a href="#acessos">
            <Lock aria-hidden="true" size={18} />
            Acessos
          </a>
        </nav>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-copy">
            <p className="eyebrow">Dashboard administrativo</p>
            <h1>Analise das coletas PAF</h1>
            <p>Dados de campo, mapas, indicadores e controle de acesso em uma central.</p>
          </div>
          <div className="header-quick-stats">
            <span>
              <strong>{metrics.total}</strong>
              Formularios
            </span>
            <span>
              <strong>{dashboardCommunities.length}</strong>
              Comunidades
            </span>
            <span>
              <strong>{accessStats.active}</strong>
              Usuarios ativos
            </span>
          </div>
          <div className="admin-actions">
            <span>
              <Shield aria-hidden="true" size={16} />
              {user.name}
            </span>
            <button className="icon-button" onClick={onLogout} title="Sair" type="button">
              <LogOut aria-hidden="true" size={19} />
            </button>
          </div>
        </header>

        <section className="filter-bar" aria-label="Filtros">
          <label className="search-field">
            <Search aria-hidden="true" size={18} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" value={query} />
          </label>

          <label>
            <Filter aria-hidden="true" size={17} />
            <select value={community} onChange={(event) => setCommunity(event.target.value)}>
              <option>Todas</option>
              {dashboardCommunities.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label>
            <User aria-hidden="true" size={17} />
            <select value={collector} onChange={(event) => setCollector(event.target.value)}>
              <option>Todos</option>
              {collectors.map((item) => (
                <option key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>

          <label>
            <CloudUpload aria-hidden="true" size={17} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>Todos</option>
              <option value="synced">Sincronizado</option>
              <option value="pending_sync">Pendente</option>
              <option value="draft_local">Rascunho</option>
              <option value="sync_error">Erro</option>
            </select>
          </label>
        </section>

        <section className="metric-grid" id="indicadores">
          <Metric icon={<FileText size={20} />} label="Formularios" value={metrics.total} />
          <Metric icon={<Users size={20} />} label="Familias" value={metrics.families} />
          <Metric icon={<Camera size={20} />} label="Fotos" value={metrics.photos} />
          <Metric icon={<CheckCircle size={20} />} label="Sincronizados" value={metrics.synced} />
          <Metric icon={<Clock size={20} />} label="Pendentes" value={metrics.pending} tone="orange" />
        </section>

        <section className="dashboard-grid">
          <article className="dashboard-panel">
            <div className="panel-heading">
              <h2>Coletas por comunidade</h2>
              <Database aria-hidden="true" size={20} />
            </div>
            <div className="bar-list">
              {communityBars.map((item) => (
                <div className="bar-row" key={item.name}>
                  <span>{item.name}</span>
                  <div>
                    <i style={{ width: `${Math.max(8, (item.count / maxCommunityCount) * 100)}%` }} />
                  </div>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-panel" id="mapa">
            <div className="panel-heading">
              <h2>Mapa de coletas</h2>
              <MapPin aria-hidden="true" size={20} />
            </div>
            <MapPreview forms={filteredForms} />
          </article>
        </section>

        <section className="dashboard-panel" id="registros">
          <div className="panel-heading table-heading">
            <h2>Registros coletados</h2>
            <div>
              <button className="secondary-button compact" onClick={downloadCsv} type="button">
                <Download aria-hidden="true" size={17} />
                Excel/CSV
              </button>
              <button className="secondary-button compact" onClick={() => window.print()} type="button">
                <Printer aria-hidden="true" size={17} />
                PDF
              </button>
            </div>
          </div>

          <div className="records-table-wrap">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Formulario</th>
                  <th>Comunidade</th>
                  <th>Coletor</th>
                  <th>Familias</th>
                  <th>Fotos</th>
                  <th>GPS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredForms.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>
                      <strong>{item.communityName}</strong>
                      <span>{item.municipality}</span>
                    </td>
                    <td>{item.collectorName}</td>
                    <td>{item.families}</td>
                    <td>{item.photos.length}</td>
                    <td>{item.gpsLat.toFixed(4)}, {item.gpsLng.toFixed(4)}</td>
                    <td>
                      <StatusBadge status={item.syncStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-panel" id="coletores">
          <div className="panel-heading">
            <h2>Coletores</h2>
            <Plus aria-hidden="true" size={20} />
          </div>
          <div className="collector-admin-list">
            {collectors.map((collectorUser) => {
              const total = dashboardForms.filter((item) => item.userId === collectorUser.id).length
              return (
                <div className="collector-admin-row" key={collectorUser.id}>
                  <span>
                    <User aria-hidden="true" size={18} />
                    {collectorUser.name}
                  </span>
                  <strong>{total} coletas</strong>
                  <em>{collectorUser.active ? 'Ativo' : 'Inativo'}</em>
                </div>
              )
            })}
          </div>
        </section>

        <section className="dashboard-panel access-panel" id="acessos">
          <div className="panel-heading">
            <div>
              <h2>Acessos e senhas</h2>
              <p>Controle usuarios do app mobile e do dashboard administrativo.</p>
            </div>
            <Lock aria-hidden="true" size={20} />
          </div>

          <div className="access-summary">
            <article>
              <Smartphone aria-hidden="true" size={18} />
              <span>App mobile</span>
              <strong>{accessStats.mobile}</strong>
            </article>
            <article>
              <Monitor aria-hidden="true" size={18} />
              <span>Dashboard</span>
              <strong>{accessStats.dashboard}</strong>
            </article>
            <article>
              <CheckCircle aria-hidden="true" size={18} />
              <span>Ativos</span>
              <strong>{accessStats.active}</strong>
            </article>
            <article>
              <Lock aria-hidden="true" size={18} />
              <span>Senha temporaria</span>
              <strong>{accessStats.temporaryPasswords}</strong>
            </article>
          </div>

          <form className="access-create-form" onSubmit={createAccessUser}>
            <label>
              Nome
              <input
                onChange={(event) => setNewAccess((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do usuario"
                value={newAccess.name}
              />
            </label>
            <label>
              Usuario
              <input
                autoComplete="username"
                inputMode="text"
                onChange={(event) => setNewAccess((current) => ({ ...current, username: event.target.value }))}
                placeholder="ana, coletor01, admin"
                value={newAccess.username}
              />
            </label>
            <label>
              Perfil
              <select
                onChange={(event) =>
                  setNewAccess((current) => ({
                    ...current,
                    role: event.target.value as UserProfile['role'],
                  }))
                }
                value={newAccess.role}
              >
                <option value="collector">Coletor - app mobile</option>
                <option value="admin">Admin - dashboard</option>
              </select>
            </label>
            <button className="primary-button" type="submit">
              <Plus aria-hidden="true" size={18} />
              Criar usuario
            </button>
          </form>

          {accessMessage ? (
            <div className="access-message" role="status">
              <Shield aria-hidden="true" size={17} />
              {accessMessage}
            </div>
          ) : null}

          <div className="access-table-wrap">
            <table className="access-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Acesso</th>
                  <th>Status</th>
                  <th>Senha</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {displayAccessUsers.map((accessUser) => (
                  <tr key={accessUser.id}>
                    <td>
                      <strong>{accessUser.name}</strong>
                      <span>usuario: {accessUser.username}</span>
                    </td>
                    <td>
                      <select
                        aria-label={`Perfil de ${accessUser.name}`}
                        onChange={(event) =>
                          updateAccessUser(accessUser.id, {
                            role: event.target.value as UserProfile['role'],
                          })
                        }
                        value={accessUser.role}
                      >
                        <option value="collector">App mobile</option>
                        <option value="admin">Dashboard</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className={`status-toggle ${accessUser.active ? 'active' : 'inactive'}`}
                        onClick={() => updateAccessUser(accessUser.id, { active: !accessUser.active })}
                        type="button"
                      >
                        {accessUser.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td>
                      <div className="password-state">
                        <strong>{accessUser.passwordStatus}</strong>
                        <span>Atualizada em {formatDateTime(accessUser.passwordUpdatedAt)}</span>
                      </div>
                    </td>
                    <td>
                      <button className="secondary-button compact" onClick={() => resetPassword(accessUser.id)} type="button">
                        <RefreshCw aria-hidden="true" size={16} />
                        Resetar senha
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <DevSignature className="dashboard-dev-signature" />
      </div>
    </section>
  )
}

function StatusTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="status-tile">
      {icon}
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </article>
  )
}

function Metric({
  icon,
  label,
  value,
  tone = 'green',
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'green' | 'orange'
}) {
  return (
    <article className={`metric-card ${tone}`}>
      {icon}
      <span>{label}</span>
      <strong>{value.toLocaleString('pt-BR')}</strong>
    </article>
  )
}

function StatusBadge({ status }: { status: SyncStatus }) {
  const icon = {
    draft_local: <WifiOff aria-hidden="true" size={14} />,
    pending_sync: <Clock aria-hidden="true" size={14} />,
    synced: <CheckCircle aria-hidden="true" size={14} />,
    sync_error: <AlertTriangle aria-hidden="true" size={14} />,
  }[status]

  return (
    <span className={`status-badge ${status}`}>
      {icon}
      {syncLabel(status)}
    </span>
  )
}

function DevSignature({ className = '' }: { className?: string }) {
  return <footer className={`dev-signature ${className}`}>Desenvolvido Por Vinicius Dev</footer>
}

async function generateCollectionPdf(record: FormRecord) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  let y = 18

  const orange = '#F15925'
  const green = '#408E20'
  const text = '#1F2A1F'
  const muted = '#66736A'
  const border = '#DDE7D9'
  const soft = '#F3FAF0'

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 22) {
      return
    }

    doc.addPage()
    y = 18
  }

  const sectionTitle = (title: string) => {
    ensureSpace(14)
    doc.setTextColor(green)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(title.toUpperCase(), margin, y)
    y += 5
    doc.setDrawColor(border)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
  }

  const keyValue = (label: string, value: string | number | boolean) => {
    ensureSpace(12)
    doc.setTextColor(muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, margin, y)

    doc.setTextColor(text)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const printable = typeof value === 'boolean' ? (value ? 'Sim' : 'Nao') : String(value || '-')
    const lines = doc.splitTextToSize(printable, contentWidth - 48)
    doc.text(lines, margin + 48, y)
    y += Math.max(8, lines.length * 5)
  }

  const pill = (label: string, value: string, x: number, width: number) => {
    doc.setFillColor(soft)
    doc.setDrawColor(border)
    doc.roundedRect(x, y, width, 20, 2, 2, 'FD')
    doc.setTextColor(muted)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text(label.toUpperCase(), x + 4, y + 7)
    doc.setTextColor(text)
    doc.setFontSize(12)
    doc.text(value, x + 4, y + 15)
  }

  doc.setFillColor(orange)
  doc.rect(0, 0, pageWidth, 7, 'F')
  doc.setTextColor(text)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Relatorio de Coleta PAF', margin, y)
  doc.setTextColor(green)
  doc.setFontSize(10)
  doc.text('Agricultura Familiar · Vila Nova Agroindustrial', margin, y + 7)
  doc.setTextColor(muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, margin, y + 13)

  doc.setDrawColor(border)
  doc.roundedRect(pageWidth - margin - 52, y - 4, 52, 22, 2, 2, 'S')
  doc.setTextColor(green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('FORMULARIO', pageWidth - margin - 48, y + 4)
  doc.setTextColor(text)
  doc.setFontSize(11)
  doc.text(record.id, pageWidth - margin - 48, y + 12)
  y += 30

  pill('Comunidade', record.communityName, margin, 58)
  pill('Coletor', record.collectorName, margin + 63, 55)
  pill('Status', syncLabel(record.syncStatus), margin + 123, 55)
  y += 28

  sectionTitle('Identificacao da visita')
  keyValue('Comunidade', record.communityName)
  keyValue('Municipio', record.municipality)
  keyValue('Associacao', record.association)
  keyValue('Entrevistado', record.interviewee)
  keyValue('Telefone', record.phone)
  keyValue('Data e hora', formatDateTime(record.collectedAt))

  sectionTitle('Dados gerais')
  keyValue('Familias', record.families)
  keyValue('Habitantes', record.inhabitants)
  keyValue('Produtores parceiros', record.producers)
  keyValue('Atividades economicas', record.mainActivities)
  keyValue('Culturas predominantes', record.crops)
  keyValue('Renda predominante', record.incomeProfile)

  sectionTitle('Infraestrutura e servicos')
  keyValue('Energia', record.energy)
  keyValue('Agua', record.water)
  keyValue('Saneamento', record.sanitation)
  keyValue('Internet e telefonia', record.internet)
  keyValue('Escola', record.school)
  keyValue('UBS', record.healthUnit)
  keyValue('Riscos ambientais', record.environmentalRisks)

  sectionTitle('Relacionamento e oportunidades')
  keyValue('Avaliacao', record.companyRating)
  keyValue('Demandas', record.demands)
  keyValue('Oportunidades', record.opportunities)
  keyValue('Observacoes', record.observations)

  sectionTitle('GPS, dispositivo e sincronizacao')
  keyValue('Latitude', record.gpsLat.toFixed(6))
  keyValue('Longitude', record.gpsLng.toFixed(6))
  keyValue('Precisao GPS', `${record.gpsAccuracy}m`)
  keyValue('Dispositivo', record.device)
  keyValue('Versao do app', record.appVersion)
  keyValue('Sincronizacao', record.syncedAt ? `Enviado em ${formatDateTime(record.syncedAt)}` : syncLabel(record.syncStatus))

  sectionTitle('Registro fotografico')
  if (record.photos.length === 0) {
    keyValue('Fotos', 'Nenhuma foto registrada')
  } else {
    record.photos.forEach((photo, index) => {
      keyValue(`Foto ${index + 1}`, `${photo.category} · ${photo.fileName}`)
      keyValue('GPS da foto', `${photo.gpsLat.toFixed(6)}, ${photo.gpsLng.toFixed(6)}`)
    })
  }

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(border)
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15)
    doc.setTextColor(muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Desenvolvido Por Vinicius Dev', margin, pageHeight - 9)
    doc.text(`${page}/${totalPages}`, pageWidth - margin - 8, pageHeight - 9)
  }

  doc.save(`coleta-${record.id}.pdf`)
}

function MapPreview({ forms }: { forms: FormRecord[] }) {
  if (forms.length === 0) {
    return (
      <div className="map-empty">
        <Eye aria-hidden="true" size={22} />
        Nenhum ponto no filtro atual
      </div>
    )
  }

  const latitudes = forms.map((item) => item.gpsLat)
  const longitudes = forms.map((item) => item.gpsLng)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLng = Math.min(...longitudes)
  const maxLng = Math.max(...longitudes)

  return (
    <div className="map-preview">
      <div className="map-grid" />
      {forms.map((item) => {
        const left = scalePoint(item.gpsLng, minLng, maxLng)
        const top = 100 - scalePoint(item.gpsLat, minLat, maxLat)

        return (
          <button
            className="map-marker"
            key={item.id}
            style={{ left: `${left}%`, top: `${top}%` }}
            title={`${item.communityName} - ${item.collectorName}`}
            type="button"
          >
            <MapPin aria-hidden="true" size={18} />
          </button>
        )
      })}
    </div>
  )
}

function loadAccessUsers() {
  const stored = window.localStorage.getItem(ACCESS_USERS_KEY)

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<AccessProfile>[]

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeAccessUser)
      }
    } catch {
      return seedAccessUsers()
    }
  }

  return seedAccessUsers()
}

function seedAccessUsers(): AccessProfile[] {
  const now = new Date().toISOString()

  return users.map((item, index) => ({
    ...item,
    accessTarget: accessTargetForRole(item.role),
    lastLoginAt: index % 2 === 0 ? now : undefined,
    password: 'demo123',
    passwordStatus: 'Ativa',
    passwordUpdatedAt: now,
  }))
}

function normalizeAccessUser(item: Partial<AccessProfile>): AccessProfile {
  const role = item.role === 'admin' ? 'admin' : 'collector'

  return {
    id: item.id ?? `user-${Date.now()}`,
    name: item.name ?? 'Usuario',
    username: normalizeUsername(item.username ?? item.email ?? item.name ?? 'usuario'),
    email: item.email ?? 'usuario@paf.local',
    role,
    active: item.active ?? true,
    accessTarget: accessTargetForRole(role),
    lastLoginAt: item.lastLoginAt,
    password: item.password ?? item.temporaryPassword ?? 'demo123',
    passwordStatus: item.passwordStatus ?? 'Ativa',
    passwordUpdatedAt: item.passwordUpdatedAt ?? new Date().toISOString(),
    temporaryPassword: item.temporaryPassword,
  }
}

function draftFromCommunity(community: Community, current: DraftFormInput = emptyDraft): DraftFormInput {
  return {
    ...current,
    communityId: community.id,
    communityName: community.name,
    municipality: community.municipality,
    association: community.association,
  }
}

function accessProfileFromUserProfile(item: UserProfile): AccessProfile {
  return {
    ...item,
    accessTarget: accessTargetForRole(item.role),
    password: 'Supabase Auth',
    passwordStatus: 'Ativa',
    passwordUpdatedAt: new Date().toISOString(),
  }
}

function accessTargetForRole(role: UserProfile['role']) {
  return role === 'admin' ? 'Dashboard web' : 'App mobile'
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value
}

function generateTemporaryPassword() {
  const partA = Math.random().toString(36).slice(2, 6).toUpperCase()
  const partB = Math.floor(1000 + Math.random() * 9000)

  return `PAF-${partA}-${partB}`
}

function loadLocalForms(user: UserProfile) {
  const stored = window.localStorage.getItem(`${LOCAL_FORMS_KEY}-${user.id}`)

  if (stored) {
    try {
      return JSON.parse(stored) as FormRecord[]
    } catch {
      return mockForms.filter((item) => item.userId === user.id)
    }
  }

  return mockForms.filter((item) => item.userId === user.id)
}

function persistLocalForms(user: UserProfile, forms: FormRecord[]) {
  window.localStorage.setItem(`${LOCAL_FORMS_KEY}-${user.id}`, JSON.stringify(forms))
}

function syncLabel(status: SyncStatus) {
  return {
    draft_local: 'Rascunho',
    pending_sync: 'Pendente',
    synced: 'Sincronizado',
    sync_error: 'Erro',
  }[status]
}

function getDeviceLabel() {
  const platform = navigator.platform || 'Navegador'
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  return `${isMobile ? 'Mobile' : 'Desktop'} · ${platform}`
}

function scalePoint(value: number, min: number, max: number) {
  if (max === min) {
    return 50
  }

  return 8 + ((value - min) / (max - min)) * 84
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default App
