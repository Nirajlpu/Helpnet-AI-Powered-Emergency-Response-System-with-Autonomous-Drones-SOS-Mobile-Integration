import { addIncident, updateIncidentRealtime } from '../slices/incidentsSlice.js'
import { updateTelemetry, updateDroneStatus } from '../slices/dronesSlice.js'
import { addAlert } from '../slices/uiSlice.js'

let ws = null

export const websocketMiddleware = (store) => (next) => (action) => {
    const { dispatch } = store

    if (action.type === 'websocket/connect') {
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/dashboard/'

        ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            console.log('WebSocket connected')
        }

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)

            switch (data.type) {
                case 'new_incident':
                    dispatch(addIncident(data.incident))
                    dispatch(addAlert({
                        type: 'incident',
                        severity: data.incident.severity,
                        message: `New ${data.incident.severity} priority emergency!`,
                    }))
                    break

                case 'incident_update':
                    dispatch(updateIncidentRealtime(data.incident))
                    break

                case 'drone_telemetry':
                    dispatch(updateTelemetry({
                        droneId: data.drone_id,
                        data: data.telemetry,
                    }))
                    break

                case 'drone_status':
                    dispatch(updateDroneStatus(data.drone))
                    break

                case 'drone_dispatched':
                    dispatch(addAlert({
                        type: 'drone',
                        message: `Drone ${data.drone_id} dispatched to incident`,
                    }))
                    break

                default:
                    console.log('Unknown message type:', data.type)
            }
        }

        ws.onclose = () => {
            console.log('WebSocket disconnected')
            // Auto-reconnect after 5 seconds
            setTimeout(() => {
                dispatch({ type: 'websocket/connect' })
            }, 5000)
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
        }
    }

    if (action.type === 'websocket/disconnect' && ws) {
        ws.close()
    }

    if (action.type === 'websocket/send' && ws) {
        ws.send(JSON.stringify(action.payload))
    }

    return next(action)
}