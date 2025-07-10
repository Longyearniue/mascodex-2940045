import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string }) =>
    api.post('/users/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/users/login', data),
  
  getCurrentUser: () => api.get('/users/me'),
};

// CEO Profiles API
export const ceoProfilesAPI = {
  create: (data: { name: string; company: string; position: string; bio?: string }) =>
    api.post('/ceo-profiles/', data),
  
  getAll: () => api.get('/ceo-profiles/'),
  
  getById: (id: number) => api.get(`/ceo-profiles/${id}`),
  
  update: (id: number, data: Partial<{ name: string; company: string; position: string; bio: string }>) =>
    api.put(`/ceo-profiles/${id}`, data),
  
  delete: (id: number) => api.delete(`/ceo-profiles/${id}`),
  
  uploadVoiceSample: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/ceo-profiles/${id}/voice-sample`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Documents API
export const documentsAPI = {
  upload: (profileId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/documents/${profileId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  getAll: (profileId: number) => api.get(`/documents/${profileId}`),
  
  getById: (profileId: number, documentId: number) =>
    api.get(`/documents/${profileId}/${documentId}`),
  
  delete: (profileId: number, documentId: number) =>
    api.delete(`/documents/${profileId}/${documentId}`),
};

// Interviews API
export const interviewsAPI = {
  create: (profileId: number, data: { title: string; content: string }) =>
    api.post(`/interviews/${profileId}`, data),
  
  getAll: (profileId: number) => api.get(`/interviews/${profileId}`),
  
  getById: (profileId: number, interviewId: number) =>
    api.get(`/interviews/${profileId}/${interviewId}`),
  
  update: (profileId: number, interviewId: number, data: Partial<{ title: string; content: string }>) =>
    api.put(`/interviews/${profileId}/${interviewId}`, data),
  
  delete: (profileId: number, interviewId: number) =>
    api.delete(`/interviews/${profileId}/${interviewId}`),
};

// Chat API
export const chatAPI = {
  startSession: (data: { message: string; ceo_profile_id: number }) =>
    api.post('/chat/start', data),
  
  continueSession: (data: { message: string; session_id: string; ceo_profile_id: number }) =>
    api.post('/chat/continue', data),
  
  getSessions: () => api.get('/chat/sessions'),
  
  getMessages: (sessionId: string) => api.get(`/chat/sessions/${sessionId}/messages`),
  
  deleteSession: (sessionId: string) => api.delete(`/chat/sessions/${sessionId}`),
};

export default api;