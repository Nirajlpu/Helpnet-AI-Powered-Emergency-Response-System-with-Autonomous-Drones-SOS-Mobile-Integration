import { createTheme } from '@mui/material/styles'

const shared = {
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 700, fontSize: '2rem' },
        h2: { fontWeight: 600, fontSize: '1.75rem' },
        h3: { fontWeight: 600, fontSize: '1.5rem' },
        h4: { fontWeight: 600, fontSize: '1.25rem' },
        h5: { fontWeight: 500, fontSize: '1.125rem' },
        h6: { fontWeight: 500, fontSize: '1rem' },
        subtitle1: { fontWeight: 500 },
        subtitle2: { fontWeight: 500 },
        button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: { borderRadius: 8 },
    components: {
        MuiButton: {
            styleOverrides: { root: { borderRadius: 8, textTransform: 'none', fontWeight: 600 } },
        },
        MuiPaper: {
            styleOverrides: { root: { backgroundImage: 'none' } },
        },
    },
}

// ─── Dark Theme ───
export const darkTheme = createTheme({
    ...shared,
    palette: {
        mode: 'dark',
        primary: { main: '#ff4444', light: '#ff7777', dark: '#cc0000', contrastText: '#fff' },
        secondary: { main: '#00bcd4', light: '#4dd0e1', dark: '#0097a7', contrastText: '#fff' },
        background: { default: '#121212', paper: '#1e1e1e' },
        text: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.7)', disabled: 'rgba(255,255,255,0.5)' },
        error: { main: '#ff4444' },
        warning: { main: '#ffcc00' },
        info: { main: '#00bcd4' },
        success: { main: '#00cc00' },
    },
    components: {
        ...shared.components,
        MuiCard: {
            styleOverrides: { root: { backgroundColor: '#1e1e1e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' } },
        },
        MuiAppBar: {
            styleOverrides: { root: { backgroundColor: '#1e1e1e', borderBottom: '1px solid rgba(255,255,255,0.1)' } },
        },
        MuiDrawer: {
            styleOverrides: { paper: { backgroundColor: '#1e1e1e', borderRight: '1px solid rgba(255,255,255,0.1)' } },
        },
    },
})

// ─── Light Theme ───
export const lightTheme = createTheme({
    ...shared,
    palette: {
        mode: 'light',
        primary: { main: '#d32f2f', light: '#ef5350', dark: '#c62828', contrastText: '#fff' },
        secondary: { main: '#0097a7', light: '#26c6da', dark: '#00838f', contrastText: '#fff' },
        background: { default: '#f5f5f5', paper: '#ffffff' },
        text: { primary: '#1a1a1a', secondary: 'rgba(0,0,0,0.6)', disabled: 'rgba(0,0,0,0.38)' },
        error: { main: '#d32f2f' },
        warning: { main: '#ed6c02' },
        info: { main: '#0288d1' },
        success: { main: '#2e7d32' },
    },
    components: {
        ...shared.components,
        MuiCard: {
            styleOverrides: { root: { backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)' } },
        },
        MuiAppBar: {
            styleOverrides: { root: { backgroundColor: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.08)', color: '#1a1a1a' } },
        },
        MuiDrawer: {
            styleOverrides: { paper: { backgroundColor: '#ffffff', borderRight: '1px solid rgba(0,0,0,0.08)' } },
        },
    },
})

// Backward compat — default dark
export const theme = darkTheme