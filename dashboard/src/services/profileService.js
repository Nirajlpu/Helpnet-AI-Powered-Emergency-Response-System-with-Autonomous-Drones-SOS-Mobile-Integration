import { api } from './api.js'

export const profileService = {
    // GET /api/profiles/ — list all profiles (with filters)
    getAll: (params = {}) => api.get('/profiles/', { params }),

    // GET /api/profiles/:id/ — get a single profile
    getById: (id) => api.get(`/profiles/${id}/`),

    // GET /api/profiles/me/ — get current user's profile
    getMyProfile: () => api.get('/profiles/me/'),

    // POST /api/profiles/ — create a new profile
    create: (data) => api.post('/profiles/', data),

    // PATCH /api/profiles/:id/ — update a profile
    update: (id, data) => api.patch(`/profiles/${id}/`, data),

    // GET /api/profiles/:id/family/ — get family members
    getFamily: (id) => api.get(`/profiles/${id}/family/`),

    // POST /api/profiles/:id/add_family/ — add family relation
    addFamily: (id, data) => api.post(`/profiles/${id}/add_family/`, data),

    // DELETE /api/profiles/:id/remove_family/?to_user=xxx
    removeFamily: (id, toUserId) =>
        api.delete(`/profiles/${id}/remove_family/`, { params: { to_user: toUserId } }),
}
