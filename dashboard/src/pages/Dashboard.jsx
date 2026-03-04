import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Grid, Paper, Typography, Box, Alert, Snackbar } from '@mui/material'
import {
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Sensors as SensorsIcon,
    Autorenew as AutorenewIcon,
    RateReview as RateReviewIcon,
} from '@mui/icons-material'

import DroneMap from '@components/map/DroneMap.jsx'
import StatsCard from '@components/dashboard/StatsCard.jsx'
import ActiveIncidentsList from '@components/dashboard/ActiveIncidentsList.jsx'
import { useWebSocket } from '@hooks/useWebSocket.js'
import { removeAlert } from '@store/slices/uiSlice.js'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/dashboard/'

const Dashboard = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { items: incidents, stats } = useSelector((state) => state.incidents)
    const { items: drones } = useSelector((state) => state.drones)
    const { alerts } = useSelector((state) => state.ui)

    const { isConnected, lastMessage } = useWebSocket(WS_URL)

    useEffect(() => {
        if (lastMessage) {
            console.log('WebSocket message:', lastMessage)
        }
    }, [lastMessage])

    const handleCloseAlert = (index) => {
        dispatch(removeAlert(index))
    }

    const activeIncidents = (incidents || []).filter(inc => inc.status !== 'RESOLVED');
    const liveIncidents = activeIncidents.filter(inc => inc.status === 'DISPATCHED' || inc.status === 'EN_ROUTE');
    const inProgressIncidents = activeIncidents.filter(inc => inc.status === 'ON_SCENE');
    const underReviewIncidents = activeIncidents.filter(inc => inc.status === 'REPORTED');

    return (
        <Box sx={{ p: { xs: 1, md: 3 }, maxWidth: '100%', margin: '0 auto', width: '100%' }}>

            {/* Stats Cards */}
            <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
                gap: 3,
                mb: 3,
                '& > *': { minWidth: 0 }
            }}>
                <StatsCard
                    title="Active Incidents"
                    value={stats?.active || 0}
                    icon={<WarningIcon />}
                    color="error"
                    onClick={() => navigate('/incidents?filter=active')}
                />
                <StatsCard
                    title="Live Incidents"
                    value={liveIncidents.length}
                    icon={<SensorsIcon />}
                    color="error"
                    onClick={() => navigate('/incidents?filter=live')}
                />
                <StatsCard
                    title="In Progress"
                    value={inProgressIncidents.length}
                    icon={<AutorenewIcon />}
                    color="info"
                    onClick={() => navigate('/incidents?filter=in_progress')}
                />
                <StatsCard
                    title="Under Review"
                    value={underReviewIncidents.length}
                    icon={<RateReviewIcon />}
                    color="warning"
                    onClick={() => navigate('/incidents?filter=under_review')}
                />
                <StatsCard
                    title="Resolved"
                    value={stats?.resolved || 0}
                    icon={<CheckCircleIcon />}
                    color="success"
                    onClick={() => navigate('/incidents?filter=resolved')}
                />
            </Box>



            {/* Main Content - Incidents fill space, radar fixed on right */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: '10px' }}>
                {/* Left: Active Incidents - takes all remaining space */}
                <Box sx={{ flex: 1, minWidth: 0, height: 'calc(100vh - 280px)', minHeight: 450 }}>
                    <ActiveIncidentsList />
                </Box>

                {/* Right: Radar - fixed width, pinned to right edge */}
                <Box sx={{ width: { xs: '100%', md: 460 }, flexShrink: 0, height: 'calc(100vh - 400px)', minHeight: 450, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Box sx={{
                        width: 450,
                        height: 450,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid rgba(0, 255, 0, 0.2)',
                        boxShadow: '0 0 30px rgba(0, 255, 0, 0.1)',
                        flexShrink: 0
                    }}>
                        <DroneMap />
                    </Box>
                </Box>
            </Box>

            {/* Alert Snackbar */}
            <Snackbar
                open={alerts.length > 0}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert
                    severity={alerts[0]?.severity === 'CRITICAL' ? 'error' : 'warning'}
                    onClose={() => handleCloseAlert(0)}
                    sx={{ width: '100%' }}
                >
                    {alerts[0]?.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default Dashboard