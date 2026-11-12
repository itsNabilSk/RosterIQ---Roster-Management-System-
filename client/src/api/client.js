const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const res = await fetch(url, config);
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const errorMsg =
        data?.error?.message ||
        (res.status === 502 || res.status === 503
          ? 'Backend service is starting up (cold start). Please retry in 10-15 seconds.'
          : `HTTP ${res.status}: Request failed`);
      const err = new Error(errorMsg);
      err.code = data?.error?.code || `HTTP_${res.status}`;
      err.details = data?.error?.details || data?.error?.conflicts;
      err.status = res.status;
      throw err;
    }
    return data ? data.data : null;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Roster
  generateRoster: (month, year, strategy = 'BALANCED') =>
    request('/roster/generate', { method: 'POST', body: JSON.stringify({ month, year, strategy }) }),
  compareRosterPlans: (month, year) =>
    request('/roster/compare', { method: 'POST', body: JSON.stringify({ month, year }) }),
  getRoster: (id) => request(`/roster/${id}`),
  findRoster: (month, year) => request(`/roster/find?month=${month}&year=${year}`),
  getRosterView: (id, viewType) => request(`/roster/${id}/views/${viewType}`),
  updateEntry: (rosterId, entryId, status, note) =>
    request(`/roster/${rosterId}/entries/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
  getSuggestions: (rosterId, { date, brandId, processId, employeeIds }) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (brandId) params.set('brandId', brandId);
    if (processId) params.set('processId', processId);
    if (employeeIds) params.set('employeeIds', Array.isArray(employeeIds) ? employeeIds.join(',') : employeeIds);
    return request(`/roster/${rosterId}/suggestions?${params.toString()}`);
  },
  assignBackup: (rosterId, { employeeId, processId, date }) =>
    request(`/roster/${rosterId}/assign-backup`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, processId, date }),
    }),
  publishRoster: (rosterId, publishOverrideReason) =>
    request(`/roster/${rosterId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ publishOverrideReason }),
    }),

  // CRUD Resources
  getEmployees: (params = '') => request(`/employees${params}`),
  createEmployee: (data) => request('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id, data) => request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEmployee: (id) => request(`/employees/${id}`, { method: 'DELETE' }),

  getPods: () => request('/pods'),
  createPod: (data) => request('/pods', { method: 'POST', body: JSON.stringify(data) }),
  updatePod: (id, data) => request(`/pods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePod: (id) => request(`/pods/${id}`, { method: 'DELETE' }),

  getBrands: () => request('/brands'),
  createBrand: (data) => request('/brands', { method: 'POST', body: JSON.stringify(data) }),
  updateBrand: (id, data) => request(`/brands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBrand: (id) => request(`/brands/${id}`, { method: 'DELETE' }),

  getProcesses: (params = '') => request(`/processes${params}`),
  createProcess: (data) => request('/processes', { method: 'POST', body: JSON.stringify(data) }),
  updateProcess: (id, data) => request(`/processes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProcess: (id) => request(`/processes/${id}`, { method: 'DELETE' }),

  getAssignments: (params = '') => request(`/assignments${params}`),
  createAssignment: (data) => request('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  updateAssignment: (id, data) => request(`/assignments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAssignment: (id) => request(`/assignments/${id}`, { method: 'DELETE' }),

  getHolidays: () => request('/holidays'),
  createHoliday: (data) => request('/holidays', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoliday: (id) => request(`/holidays/${id}`, { method: 'DELETE' }),

  getLeaves: (params = '') => request(`/leaves${params}`),
  createLeave: (data) => request('/leaves', { method: 'POST', body: JSON.stringify(data) }),
  updateLeave: (id, data) => request(`/leaves/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLeave: (id) => request(`/leaves/${id}`, { method: 'DELETE' }),

  // Demo
  resetDemo: () => request('/demo/reset', { method: 'POST' }),
  getDemoStatus: () => request('/demo/status'),
};

