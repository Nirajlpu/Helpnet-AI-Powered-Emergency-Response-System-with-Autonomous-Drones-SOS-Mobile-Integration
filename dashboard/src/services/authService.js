import { api } from './api.js'

export const authService = {
    login: (credentials) => api.post('/auth/login/', credentials),

    logout: () => api.post('/auth/logout/'),

    getProfile: () => api.get('/auth/profile/'),

    refreshToken: () => api.post('/auth/refresh/'),
}