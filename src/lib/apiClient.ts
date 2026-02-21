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

  async update(id: string, expense: any) {
    return apiFetch(`/expenses/${id}`, {
      method: 'PUT',
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

  async getTransfers(account_id?: string) {
    const queryString = account_id ? `?account_id=${account_id}` : '';
    return apiFetch(`/banks/transfers${queryString}`);
  },

  async getAccountTransactions(id: string) {
    return apiFetch(`/banks/${id}/transactions`);
  },

  // Cheque management
  async getCheques(params?: { bank_account_id?: string; status?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/banks/cheques${queryString}`);
  },

  async createCheque(cheque: any) {
    return apiFetch('/banks/cheques', {
      method: 'POST',
      body: JSON.stringify(cheque),
    });
  },

  async updateCheque(id: string, cheque: any) {
    return apiFetch(`/banks/cheques/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cheque),
    });
  },

  async depositCheque(id: string, to_account_id: string, deposit_date?: string) {
    return apiFetch(`/banks/cheques/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ to_account_id, deposit_date }),
    });
  },

  async cancelCheque(id: string) {
    return apiFetch(`/banks/cheques/${id}/cancel`, {
      method: 'POST',
    });
  },
};

// Managing Director API
export const mdApi = {
  async getAll() {
    return apiFetch('/managing-directors');
  },
  async create(data: { name: string; contact?: string }) {
    return apiFetch('/managing-directors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async delete(id: string) {
    return apiFetch(`/managing-directors/${id}`, {
      method: 'DELETE',
    });
  },
};

// User API
export const userApi = {
  async getAll() {
    return apiFetch('/users');
  },

  async getSupervisors() {
    return apiFetch('/users/supervisors');
  },

  async getTransactionUsers() {
    return apiFetch('/users/transaction-users');
  },

  async getMe() {
    return apiFetch('/users/me');
  },

  async createUser(userData: { email: string; password: string; full_name: string; phone?: string; role: string }) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async updateRole(id: string, role: string) {
    return apiFetch(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async delete(id: string) {
    return apiFetch(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// Approval API
export const approvalApi = {
  async getForRecord(recordId: string) {
    return apiFetch(`/approvals/record/${recordId}`);
  },
};

// Ledger API
export const ledgerApi = {
  async getAccounts() {
    return apiFetch('/ledger/accounts');
  },

  async getAccountById(id: string) {
    return apiFetch(`/ledger/accounts/${id}`);
  },

  async getAccountEntries(id: string, params?: { startDate?: string; endDate?: string; limit?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return apiFetch(`/ledger/accounts/${id}/entries${query ? `?${query}` : ''}`);
  },

  async getSummary() {
    return apiFetch('/ledger/summary');
  },

  async getTrialBalance(params?: { startDate?: string; endDate?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const query = queryParams.toString();
    return apiFetch(`/ledger/trial-balance${query ? `?${query}` : ''}`);
  },

  async getExpenseBreakdown(params?: { startDate?: string; endDate?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const query = queryParams.toString();
    return apiFetch(`/ledger/expense-breakdown${query ? `?${query}` : ''}`);
  },

  async getUserCashBalance(userId: string) {
    return apiFetch(`/ledger/user-cash-balance/${userId}`);
  },
};
