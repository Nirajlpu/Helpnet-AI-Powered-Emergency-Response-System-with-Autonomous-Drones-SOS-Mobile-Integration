import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider, useSelector } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

import App from './App.jsx'
import { store } from './store/store.js'
import { darkTheme, lightTheme } from './styles/theme.js'

import './index.css'

const ThemedApp = () => {
  const themeMode = useSelector((state) => state.ui.themeMode)
  const theme = themeMode === 'light' ? lightTheme : darkTheme

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ThemedApp />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)