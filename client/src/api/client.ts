import type {
  User,
  Account,
  Category,
  Transaction,
  Budget,
  Trip,
  Goal,
  LoansSummary,
  Bill,
  Notification,
  AIInsight,
  DashboardData,
  Receipt,
  ReceiptEmail,
} from '../types/index.js';

// If VITE_API_URL is set (e.g. deployed on Vercel connecting to Render/Railway), use it; otherwise default to '/api'
const envApiUrl = (import.meta as any).env?.VITE_API_URL || '';
const API_HOST = typeof envApiUrl === 'string' ? envApiUrl.replace(/\/$/, '') : '';
const BASE_URL = `${API_HOST}/api`;

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    const errorMsg = data.error || (data.details && data.details[0]?.message) || 'Request failed';
    throw new Error(errorMsg);
  }

  return (data.data !== undefined ? data.data : data) as T;
}

export const api = {
  // Auth
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (userData: { email: string; password: string; name: string }) =>
      request<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    me: () => request<User>('/auth/me'),
    updateProfile: (profile: Partial<User>) =>
      request<User>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(profile),
      }),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Dashboard
  dashboard: {
    get: () => request<DashboardData>('/dashboard'),
  },

  // Accounts
  accounts: {
    getAll: () => request<Account[]>('/accounts'),
    create: (account: Partial<Account>) =>
      request<Account>('/accounts', {
        method: 'POST',
        body: JSON.stringify(account),
      }),
    update: (id: string, updates: Partial<Account>) =>
      request<Account>(`/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/accounts/${id}`, { method: 'DELETE' }),
  },

  // Transactions
  transactions: {
    getAll: (params?: Record<string, any>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Transaction[]>(`/transactions${query}`);
    },
    create: (tx: any) =>
      request<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify(tx),
      }),
    duplicate: (id: string) =>
      request<Transaction>(`/transactions/${id}/duplicate`, { method: 'POST' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/transactions/${id}`, { method: 'DELETE' }),
    getCategories: () => request<Category[]>('/transactions/categories'),
    createCategory: (cat: { name: string; type: 'EXPENSE' | 'INCOME'; icon?: string; color?: string }) =>
      request<Category>('/transactions/categories', {
        method: 'POST',
        body: JSON.stringify(cat),
      }),
  },

  // Budgets
  budgets: {
    getAll: () => request<Budget[]>('/budgets'),
    create: (budget: any) =>
      request<Budget>('/budgets', {
        method: 'POST',
        body: JSON.stringify(budget),
      }),
    update: (id: string, updates: any) =>
      request<Budget>(`/budgets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/budgets/${id}`, { method: 'DELETE' }),
  },

  // Trips
  trips: {
    getAll: () => request<Trip[]>('/trips'),
    getById: (id: string) => request<Trip>(`/trips/${id}`),
    create: (trip: any) =>
      request<Trip>('/trips', {
        method: 'POST',
        body: JSON.stringify(trip),
      }),
    addContribution: (tripId: string, data: { amountPaise: number; accountId: string; notes?: string }) =>
      request<Trip>(`/trips/${tripId}/contributions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    addExpense: (tripId: string, expense: any) =>
      request<any>(`/trips/${tripId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(expense),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/trips/${id}`, { method: 'DELETE' }),
  },

  // Goals
  goals: {
    getAll: () => request<Goal[]>('/goals'),
    create: (goal: any) =>
      request<Goal>('/goals', {
        method: 'POST',
        body: JSON.stringify(goal),
      }),
    addContribution: (goalId: string, data: { amountPaise: number; accountId?: string; notes?: string }) =>
      request<any>(`/goals/${goalId}/contributions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/goals/${id}`, { method: 'DELETE' }),
  },

  // Loans (Udhaar)
  loans: {
    getSummary: () => request<LoansSummary>('/loans'),
    create: (loan: any) =>
      request<any>('/loans', {
        method: 'POST',
        body: JSON.stringify(loan),
      }),
    addPayment: (loanId: string, payment: any) =>
      request<any>(`/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payment),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/loans/${id}`, { method: 'DELETE' }),
  },

  // Bills
  bills: {
    getAll: () => request<Bill[]>('/bills'),
    create: (bill: any) =>
      request<Bill>('/bills', {
        method: 'POST',
        body: JSON.stringify(bill),
      }),
    pay: (id: string, data?: { accountId?: string }) =>
      request<Bill>(`/bills/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/bills/${id}`, { method: 'DELETE' }),
  },

  // AI Insights & Chat
  ai: {
    getInsights: () => request<AIInsight[]>('/ai/insights'),
    dismissInsight: (id: string) =>
      request<{ message: string }>(`/ai/insights/${id}/dismiss`, { method: 'POST' }),
    chat: (message: string) =>
      request<{ reply: string; data?: any; proposal?: any }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  },

  // Reports
  reports: {
    getMonthly: (year: number, month: number) =>
      request<any>(`/reports/monthly?year=${year}&month=${month}`),
    getYearly: (year: number) =>
      request<any>(`/reports/yearly?year=${year}`),
  },

  // Global Search
  search: {
    query: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),
  },

  // Notifications
  notifications: {
    getAll: () => request<Notification[]>('/notifications'),
    markRead: (id: string) =>
      request<Notification>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ message: string }>('/notifications/mark-all-read', { method: 'POST' }),
  },

  // Export & Reset
  exportReset: {
    exportJSONUrl: '/api/export',
    exportCSVUrl: '/api/export/csv',
    resetData: (payload: { confirmationText: string; password: string }) =>
      request<{ success: boolean; message: string }>('/reset/reset', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Receipts (Udhaar / Peer Lending)
  receipts: {
    getForLoan: (loanId: string) => request<Receipt[]>(`/loans/${loanId}/receipts`),
    getById: (id: string) => request<Receipt>(`/receipts/${id}`),
    downloadPdf: async (receiptId: string, filename?: string) => {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${BASE_URL}/receipts/${receiptId}/pdf`, { headers });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to download PDF receipt');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `Receipt-${receiptId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    sendEmail: (receiptId: string, data: { recipientEmail: string; recipientName?: string; customMessage?: string }) =>
      request<{ emailId: string; status: 'SENT' | 'FAILED'; message: string }>(`/receipts/${receiptId}/email`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resendEmail: (receiptId: string, data?: { recipientEmail?: string; recipientName?: string; customMessage?: string }) =>
      request<{ emailId: string; status: 'SENT' | 'FAILED'; message: string }>(`/receipts/${receiptId}/resend`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
      }),
    getEmailHistory: (receiptId: string) => request<ReceiptEmail[]>(`/receipts/${receiptId}/email-history`),
    verify: (verificationId: string) => request<any>(`/receipts/verify/${verificationId}`),
  },
};

