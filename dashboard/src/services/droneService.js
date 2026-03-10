import { api } from './api.js'

export const droneService = {
    // GET /api/drones/
    getAll: () => api.get('/drones/'),

    // GET /api/drones/:id/
    getById: (id) => api.get(`/drones/${id}/`),

    // POST /api/drones/:id/telemetry/
    updateTelemetry: (droneId, data) =>
        api.post(`/drones/${droneId}/telemetry/`, data),

    // POST /api/drones/:id/command/ — { command: 'return_home' | 'hover' }
    sendCommand: (droneId, command) =>
        api.post(`/drones/${droneId}/command/`, { command }),
}