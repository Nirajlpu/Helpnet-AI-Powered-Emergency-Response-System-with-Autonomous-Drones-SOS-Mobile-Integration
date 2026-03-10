import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { Box, CircularProgress } from '@mui/material'
import { fetchProfile } from '@store/slices/authSlice.js'

import MainLayout from '@components/layout/MainLayout'
import Login from '@pages/Login'

// Lazy-loaded pages — only loaded when navigated to
const Dashboard = lazy(() => import('@pages/Dashboard'))
const Incidents = lazy(() => import('@pages/Incidents'))
const IncidentDetailPage = lazy(() => import('@pages/IncidentDetailPage'))
const IncidentVideoPage = lazy(() => import('@pages/IncidentVideoPage'))
const Drones = lazy(() => import('@pages/Drones'))
const DroneDetailPage = lazy(() => import('@pages/DroneDetailPage'))
const Analytics = lazy(() => import('@pages/Analytics'))
const Settings = lazy(() => import('@pages/Settings'))
const Profile = lazy(() => import('@pages/Profile'))
const SystemHealth = lazy(() => import('@pages/SystemHealth'))

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress />
  </Box>
)

function App() {
  const dispatch = useDispatch()
  const { isAuthenticated, profile, profileFetched } = useSelector((state) => state.auth)

  useEffect(() => {
    if (isAuthenticated && !profileFetched) {
      dispatch(fetchProfile())
    }
  }, [isAuthenticated, profileFetched, dispatch])

  if (!isAuthenticated) {
    return <Login />
  }

  return (
    <MainLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/incidents/:id/video" element={<IncidentVideoPage />} />
          <Route path="/drones" element={<Drones />} />
          <Route path="/drones/:id" element={<DroneDetailPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/system-health" element={<SystemHealth />} />
        </Routes>
      </Suspense>
    </MainLayout>
  )
}

export default App