import type {
  BenchmarkData, CalculateRequest, SuggestWeightsRequest, ExportRequest, CalculationResponse,
  YoYRequest, YoYResponse,
} from '../types/BenchmarkingTypes'

const BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api/v1`

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  return res.json()
}

// Site-wide session auth (single shared password, server-verified session cookie)
const AUTH_BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api/v1/auth`

export const authApi = {
  checkSession: (): Promise<{ authenticated: boolean }> =>
    fetch(`${AUTH_BASE}/session`, { credentials: 'include' }).then(r => r.json()),

  login: async (password: string): Promise<void> => {
    const res = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }))
      throw new Error(err.detail ?? 'Login failed')
    }
  },

  logout: (): Promise<void> =>
    fetch(`${AUTH_BASE}/logout`, { method: 'POST', credentials: 'include' }).then(() => undefined),
}

// STIP
export const stipApi = {
  simulate: (payload: object) =>
    request('/stip/simulate', { method: 'POST', body: JSON.stringify(payload) }),

  validateMatrix: (matrix: number[][]) =>
    request('/stip/validate-matrix', {
      method: 'POST',
      body: JSON.stringify({ correlation_matrix: matrix }),
    }),

  export: async (payload: object): Promise<void> => {
    const res = await fetch(`${BASE}/stip/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'STIP_Analysis.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },
}

// LTIP
export const ltipApi = {
  downloadTemplate: async (): Promise<void> => {
    const res = await fetch(`${BASE}/ltip/template`, { credentials: 'include' })
    if (!res.ok) throw new Error('Template download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'LTIP_Data_Template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },

  uploadData: async (file: File): Promise<object> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/ltip/upload-data`, { method: 'POST', credentials: 'include', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? 'Upload failed')
    }
    return res.json()
  },

  simulate: (payload: object) =>
    request('/ltip/simulate', { method: 'POST', body: JSON.stringify(payload) }),

  export: async (payload: object): Promise<void> => {
    const res = await fetch(`${BASE}/ltip/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'LTIP_Analysis.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },
}

// Compensation Benchmarking
export const benchmarkingApi = {
  uploadBenchmarkFile: async (file: File): Promise<BenchmarkData> => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/benchmarking/upload`, { method: 'POST', credentials: 'include', body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? 'Upload failed')
    }
    return res.json()
  },

  calculateBenchmarking: (payload: CalculateRequest): Promise<CalculationResponse> =>
    request('/benchmarking/calculate', { method: 'POST', body: JSON.stringify(payload) }),

  suggestWeights: (payload: SuggestWeightsRequest): Promise<Record<string, number>> =>
    request('/benchmarking/suggest-weights', { method: 'POST', body: JSON.stringify(payload) }),

  getYoY: (payload: YoYRequest): Promise<YoYResponse> =>
    request('/benchmarking/yoy', { method: 'POST', body: JSON.stringify(payload) }),

  exportBenchmarking: async (payload: ExportRequest): Promise<void> => {
    const res = await fetch(`${BASE}/benchmarking/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('Export failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Compensation_Benchmarking_Analysis.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },
}
