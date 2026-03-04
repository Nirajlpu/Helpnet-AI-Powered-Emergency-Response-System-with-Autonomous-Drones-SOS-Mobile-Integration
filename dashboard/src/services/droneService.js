import { api } from './api.js'

export const droneService = {
    getAll: () => api.get('/drones/'),

    getById: (id) => api.get(`/drones/${id}/`),

    updateTelemetry: (droneId, data) =>
        api.post(`/drones/${droneId}/telemetry/`, data),

    sendCommand: (droneId, command) =>
        api.post(`/drones/${droneId}/command/`, { command }),
}