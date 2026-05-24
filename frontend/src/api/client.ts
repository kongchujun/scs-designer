import axios from 'axios'
import type {
  ComponentDef,
  DesignDocument,
  SimulationResponse,
  ValidationResponse,
} from '@/types/design'

const api = axios.create({ baseURL: '/api/v1' })

export interface Project {
  id: number
  name: string
  description: string | null
  meta_json: Record<string, unknown> | null
  created_at: string
}

export interface Design {
  id: number
  project_id: number
  name: string
  config_json: DesignDocument
  thumbnail: string | null
  updated_at: string
}

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  create: (data: { name: string; description?: string }) =>
    api.post<Project>('/projects', data).then((r) => r.data),
  remove: (id: number) => api.delete(`/projects/${id}`),
}

export const designsApi = {
  list: (projectId?: number) =>
    api
      .get<Design[]>('/designs', { params: projectId ? { project_id: projectId } : {} })
      .then((r) => r.data),
  get: (id: number) => api.get<Design>(`/designs/${id}`).then((r) => r.data),
  create: (data: { project_id: number; name: string; config_json?: DesignDocument }) =>
    api.post<Design>('/designs', data).then((r) => r.data),
  update: (id: number, data: { name?: string; config_json?: DesignDocument; thumbnail?: string }) =>
    api.patch<Design>(`/designs/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/designs/${id}`),
}

export const componentsApi = {
  list: () => api.get<ComponentDef[]>('/components').then((r) => r.data),
}

export const uploadsApi = {
  image: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ url: string; filename: string }>('/uploads/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },
}

export const simulationApi = {
  run: (design: DesignDocument, setpoints: { flowLph: number; pressureBar: number; temperatureC: number }) =>
    api
      .post<SimulationResponse>('/simulation/run', { design, setpoints })
      .then((r) => r.data),
}

export const validationApi = {
  check: (design: DesignDocument) =>
    api.post<ValidationResponse>('/validation/check', { design }).then((r) => r.data),
}

export const exportApi = {
  pdf: (payload: {
    design: DesignDocument
    snapshot_base64?: string
    simulation_summary?: Record<string, unknown>
  }) =>
    api.post('/export/pdf', payload, { responseType: 'blob' }).then((r) => r.data as Blob),
}
