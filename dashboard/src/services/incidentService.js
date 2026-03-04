import { api } from './api.js'

export const incidentService = {
    getAll: (params = {}) => api.get('/incidents/', { params }),

    getById: (id) => api.get(`/incidents/${id}/`),

    create: (data) => api.post('/incidents/', data),

    update: (id, data) => api.patch(`/incidents/${id}/`, data),

    dispatchDrone: (incidentId) =>
        api.post(`/incidents/${incidentId}/dispatch_drone/`),

    resolve: (incidentId) =>
        api.post(`/incidents/${incidentId}/resolve/`),

    getStats: () => api.get('/incidents/stats/'),
}