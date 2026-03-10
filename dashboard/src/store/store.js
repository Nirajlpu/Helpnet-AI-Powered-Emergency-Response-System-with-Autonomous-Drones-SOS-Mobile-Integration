import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import incidentReducer from './slices/incidentSlice.js'
import uiReducer from './slices/uiSlice.js'
import dronesReducer from './slices/dronesSlice.js'
import mapReducer from './slices/mapSlice.js'
import { websocketMiddleware } from './middleware/websocketMiddleware.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    incidents: incidentReducer,
    ui: uiReducer,
    drones: dronesReducer,
    map: mapReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(websocketMiddleware),
})

// Connect WebSocket immediately
store.dispatch({ type: 'websocket/connect' })
