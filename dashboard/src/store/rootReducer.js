import { combineReducers } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.js'
import incidentReducer from './slices/incidentSlice.js'
import uiReducer from './slices/uiSlice.js'
import droneReducer from './slices/droneSlice.js'

const rootReducer = combineReducers({
    auth: authReducer,
    incidents: incidentReducer,
    ui: uiReducer,
    drones: droneReducer
});
export default rootReducer;
