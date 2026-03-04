import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    center: [78.9629, 20.5937], // India default
    zoom: 4,
    selectedIncidentId: null,
    visibleLayers: {
        incidents: true,
        drones: true,
        heatmap: false,
    },
    bounds: null,
}

const mapSlice = createSlice({
    name: 'map',
    initialState,
    reducers: {
        setCenter: (state, action) => {
            state.center = action.payload
        },
        setZoom: (state, action) => {
            state.zoom = action.payload
        },
        selectIncidentOnMap: (state, action) => {
            state.selectedIncidentId = action.payload
        },
        toggleLayer: (state, action) => {
            const layer = action.payload
            state.visibleLayers[layer] = !state.visibleLayers[layer]
        },
        fitBounds: (state, action) => {
            state.bounds = action.payload
        },
    },
})

export const { setCenter, setZoom, selectIncidentOnMap, toggleLayer, fitBounds } = mapSlice.actions
export default mapSlice.reducer