import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

import { incidentService } from '@services/incidentService.js'

const initialState = {
    items: [],
    selectedIncident: null,
    filters: {
        status: 'all',
        severity: 'all',
        dateRange: null,
    },
    isLoading: false,
    error: null,
    stats: {
        total: 0,
        active: 0,
        resolved: 0,
        critical: 0,
    },
}

export const fetchIncidents = createAsyncThunk(
    'incidents/fetchAll',
    async (params, { rejectWithValue }) => {
        try {
            return await incidentService.getAll(params)
        } catch (error) {
            return rejectWithValue(error.message)
        }
    }
)

export const dispatchDrone = createAsyncThunk(
    'incidents/dispatchDrone',
    async (incidentId, { rejectWithValue }) => {
        try {
            return await incidentService.dispatchDrone(incidentId)
        } catch (error) {
            return rejectWithValue(error.message)
        }
    }
)

const incidentsSlice = createSlice({
    name: 'incidents',
    initialState,
    reducers: {
        selectIncident: (state, action) => {
            state.selectedIncident = action.payload
        },
        clearSelection: (state) => {
            state.selectedIncident = null
        },
        setFilters: (state, action) => {
            state.filters = { ...state.filters, ...action.payload }
        },
        updateIncidentRealtime: (state, action) => {
            const index = state.items.findIndex(i => i.id === action.payload.id)
            if (index !== -1) {
                state.items[index] = { ...state.items[index], ...action.payload }
            }
        },
        addIncident: (state, action) => {
            state.items.unshift(action.payload)
            state.stats.total++
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchIncidents.pending, (state) => {
                state.isLoading = true
            })
            .addCase(fetchIncidents.fulfilled, (state, action) => {
                state.isLoading = false
                state.items = action.payload.results || action.payload
                // Update stats
                state.stats = {
                    total: state.items.length,
                    active: state.items.filter(i => i.status !== 'RESOLVED').length,
                    resolved: state.items.filter(i => i.status === 'RESOLVED').length,
                    critical: state.items.filter(i => i.severity === 'CRITICAL').length,
                }
            })
            .addCase(fetchIncidents.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
            })
            .addCase(dispatchDrone.fulfilled, (state, action) => {
                const { incidentId, drone } = action.payload
                const incident = state.items.find(i => i.id === incidentId)
                if (incident) {
                    incident.status = 'DISPATCHED'
                    incident.assignedDrones = [...(incident.assignedDrones || []), drone]
                }
            })
    },
})

export const {
    selectIncident,
    clearSelection,
    setFilters,
    updateIncidentRealtime,
    addIncident,
} = incidentsSlice.actions
export default incidentsSlice.reducer