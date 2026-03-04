import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

import { droneService } from '@services/droneService.js'

const sampleDrones = [
    {
        id: 'DRN-001', name: 'Eagle One', status: 'DISPATCHED', assignedIncidentId: 1,
        battery: 85, altitude: 120, speed: 45,
        location: { coordinates: [72.8500, 19.0800] },
        track: [[72.8900, 19.1100], [72.8750, 19.0950], [72.8600, 19.0870], [72.8500, 19.0800]],
    },
    {
        id: 'DRN-002', name: 'Hawk Eye', status: 'DISPATCHED', assignedIncidentId: 3,
        battery: 72, altitude: 80, speed: 38,
        location: { coordinates: [77.2200, 28.6200] },
        track: [[77.2500, 28.6500], [77.2350, 28.6350], [77.2200, 28.6200]],
    },
    {
        id: 'DRN-003', name: 'Falcon Scout', status: 'AVAILABLE', assignedIncidentId: null,
        battery: 100, altitude: 0, speed: 0,
        location: { coordinates: [77.5946, 12.9716] },
        track: [],
    },
]

const initialState = {
    items: sampleDrones,
    selectedDrone: null,
    telemetry: {},
    isLoading: false,
    error: null,
}

export const fetchDrones = createAsyncThunk(
    'drones/fetchAll',
    async (_, { rejectWithValue }) => {
        try {
            return await droneService.getAll()
        } catch (error) {
            return rejectWithValue(error.message)
        }
    }
)

const dronesSlice = createSlice({
    name: 'drones',
    initialState,
    reducers: {
        selectDrone: (state, action) => {
            state.selectedDrone = action.payload
        },
        updateTelemetry: (state, action) => {
            const { droneId, data } = action.payload
            state.telemetry[droneId] = data
        },
        updateDroneStatus: (state, action) => {
            const index = state.items.findIndex(d => d.id === action.payload.id)
            if (index !== -1) {
                state.items[index] = { ...state.items[index], ...action.payload }
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDrones.fulfilled, (state, action) => {
                state.items = action.payload.results || action.payload
            })
    },
})

export const { selectDrone, updateTelemetry, updateDroneStatus } = dronesSlice.actions
export default dronesSlice.reducer