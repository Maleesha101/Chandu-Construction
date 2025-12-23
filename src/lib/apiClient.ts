// API Client for connecting frontend to custom backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token management
let authToken: string | null = localStorage.getItem('auth_token');

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export const getAuthToken = () => authToken;

// Base fetch wrapper
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth API
export const authApi = {
  async login(email: string, password: string) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async register(email: string, password: string, full_name: string, role: string) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, role }),
    });
    setAuthToken(data.token);
    return data;
  },

  logout() {
    setAuthToken(null);
  },
};

// Expense API
export const expenseApi = {
  async getAll(params?: { status?: string; site_id?: string; start_date?: string; end_date?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/expenses${queryString}`);
  },

  async getById(id: string) {
    return apiFetch(`/expenses/${id}`);
  },

  async create(expense: any) {
    return apiFetch('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  },

  async updateStatus(id: string, status: string, comments?: string) {
    return apiFetch(`/expenses/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, comments }),
    });
  },

  async delete(id: string) {
    return apiFetch(`/expenses/${id}`, {
      method: 'DELETE',
    });
  },
};

// Site API
export const siteApi = {
  async getAll(active?: boolean) {
    const queryString = active !== undefined ? `?active=${active}` : '';
    return apiFetch(`/sites${queryString}`);
  },

  async create(site: any) {
    return apiFetch('/sites', {
      method: 'POST',
      body: JSON.stringify(site),
    });
  },

  async update(id: string, site: any) {
    return apiFetch(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(site),
    });
  },
};

// Bank API
export const bankApi = {
  async getAll() {
    return apiFetch('/banks');
  },

  async create(bank: any) {
    return apiFetch('/banks', {
      method: 'POST',
      body: JSON.stringify(bank),
    });
  },

  async update(id: string, bank: any) {
    return apiFetch(`/banks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bank),
    });
  },

  async transfer(transfer: any) {
    return apiFetch('/banks/transfer', {
      method: 'POST',
      body: JSON.stringify(transfer),
    });
  },

  async getTransfers() {
    return apiFetch('/banks/transfers');
  },
};

// Managing Director API
export const mdApi = {
  async getAll() {
    return apiFetch('/managing-directors');
  },
};

// User API
export const userApi = {
  async getAll() {
    return apiFetch('/users');
  },

  async getMe() {
    return apiFetch('/users/me');
  },

  async updateRole(id: string, role: string) {
    return apiFetch(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },
};

// Approval API
export const approvalApi = {
  async getForRecord(recordId: string) {
    return apiFetch(`/approvals/record/${recordId}`);
  },
};
