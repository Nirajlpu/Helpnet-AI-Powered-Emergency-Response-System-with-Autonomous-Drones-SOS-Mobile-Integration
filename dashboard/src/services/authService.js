import { api } from './api.js'

export const authService = {
    // POST /api/auth/token/ — returns { token }
    login: (credentials) => api.post('/auth/token/', credentials),

    // POST /api/auth/register/ — returns { token, user_id, username }
    register: (data) => api.post('/auth/register/', data),

    // POST /api/auth/logout/ — deletes token server-side
    logout: () => api.post('/auth/logout/'),

    // GET /api/profiles/me/ — returns current user's UserProfile
    getProfile: () => api.get('/profiles/me/'),
}