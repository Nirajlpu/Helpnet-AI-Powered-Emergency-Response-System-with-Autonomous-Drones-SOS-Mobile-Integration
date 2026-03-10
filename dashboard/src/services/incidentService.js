import { api } from './api.js'

export const incidentService = {
    // GET /api/incidents/?status=X&severity=X&incident_type=X&date_from=X&date_to=X
    getAll: (params = {}) => api.get('/incidents/', { params }),

    // GET /api/incidents/:id/
    getById: (id) => api.get(`/incidents/${id}/`),

    // POST /api/incidents/
    create: (data) => api.post('/incidents/', data),

    // PATCH /api/incidents/:id/
    update: (id, data) => api.patch(`/incidents/${id}/`, data),

    // POST /api/incidents/:id/dispatch_drone/
    dispatchDrone: (incidentId) =>
        api.post(`/incidents/${incidentId}/dispatch_drone/`),

    // POST /api/incidents/:id/resolve/
    resolve: (incidentId) =>
        api.post(`/incidents/${incidentId}/resolve/`),

    // GET /api/incidents/stats/
    getStats: () => api.get('/incidents/stats/'),

    // POST /api/incidents/:id/assign_authority/
    assignAuthority: (incidentId, authorityId, actionStatus = 'UNDER_REVIEW') =>
        api.post(`/incidents/${incidentId}/assign_authority/`, {
            authority_id: authorityId,
            action_status: actionStatus,
        }),

    // POST /api/incidents/:id/notify_family/
    notifyFamily: (incidentId) =>
        api.post(`/incidents/${incidentId}/notify_family/`),
}