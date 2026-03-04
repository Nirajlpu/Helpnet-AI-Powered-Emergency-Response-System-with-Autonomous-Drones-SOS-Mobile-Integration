import { createSlice } from '@reduxjs/toolkit'

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('helpnet-theme') : null

export const uiSlice = createSlice({
  name: 'ui',
  initialState: { alerts: [], sidebarOpen: true, themeMode: saved || 'dark' },
  reducers: {
    addAlert: (state, action) => { state.alerts.push(action.payload) },
    removeAlert: (state, action) => { state.alerts.splice(action.payload, 1) },
    clearAllAlerts: (state) => { state.alerts = [] },
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen },
    toggleTheme: (state) => {
      state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark'
      localStorage.setItem('helpnet-theme', state.themeMode)
    },
    setTheme: (state, action) => {
      state.themeMode = action.payload
      localStorage.setItem('helpnet-theme', state.themeMode)
    },
  }
})
export const { addAlert, removeAlert, clearAllAlerts, toggleSidebar, toggleTheme, setTheme } = uiSlice.actions
export default uiSlice.reducer
