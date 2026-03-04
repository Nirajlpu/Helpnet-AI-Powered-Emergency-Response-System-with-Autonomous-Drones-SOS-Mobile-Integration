import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import {
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Box,
    Typography,
    Divider,
} from '@mui/material'
import {
    Dashboard as DashboardIcon,
    Warning as IncidentsIcon,
    Flight as DronesIcon,
    Assessment as AnalyticsIcon,
    Settings as SettingsIcon,
    Menu as MenuIcon,
    ChevronLeft as ChevronLeftIcon,
    HealthAndSafety as HealthIcon,
} from '@mui/icons-material'

import { toggleSidebar } from '@store/slices/uiSlice.js'

const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
    { path: '/incidents', label: 'Incidents', icon: IncidentsIcon },
    { path: '/drones', label: 'Drones', icon: DronesIcon },
    { path: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
    { path: '/system-health', label: 'System Health', icon: HealthIcon },
    { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

const Sidebar = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const { sidebarOpen } = useSelector((state) => state.ui)
    const [mobileOpen, setMobileOpen] = useState(false)

    const drawerWidth = sidebarOpen ? 240 : 72

    const handleNavigation = (path) => {
        navigate(path)
        setMobileOpen(false)
    }

    // System status check — all services healthy = online
    const systemOnline = true; // Set to false to simulate offline

    const drawerContent = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'primary.main',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                        H
                    </Typography>
                </Box>
                {sidebarOpen && (
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        HelpNet
                    </Typography>
                )}
            </Box>

            <IconButton
                onClick={() => dispatch(toggleSidebar())}
                sx={{ position: 'absolute', right: 8, top: 16 }}
            >
                {sidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>

            <Divider sx={{ my: 1 }} />

            <List>
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.path)

                    return (
                        <ListItem key={item.path} disablePadding>
                            <ListItemButton
                                onClick={() => handleNavigation(item.path)}
                                selected={isActive}
                                sx={{
                                    mx: 1,
                                    borderRadius: 2,
                                    '&.Mui-selected': {
                                        bgcolor: 'primary.main',
                                        '&:hover': { bgcolor: 'primary.dark' },
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ color: isActive ? 'white' : 'inherit', minWidth: 40 }}>
                                    <Icon />
                                </ListItemIcon>
                                {sidebarOpen && (
                                    <ListItemText
                                        primary={item.label}
                                        sx={{ '& .MuiListItemText-primary': { fontWeight: 500 } }}
                                    />
                                )}
                            </ListItemButton>
                        </ListItem>
                    )
                })}
            </List>

            {/* System Status at Bottom */}
            <Box sx={{ mt: 'auto', p: 1.5 }}>
                <Divider sx={{ mb: 1.5 }} />
                <Box
                    onClick={() => handleNavigation('/system-health')}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                    }}
                >
                    <Box sx={{
                        width: 10, height: 10, borderRadius: '50%',
                        bgcolor: systemOnline ? '#4caf50' : '#f44336',
                        boxShadow: systemOnline ? '0 0 8px #4caf50' : '0 0 8px #f44336',
                        animation: 'pulse 2s infinite',
                    }} />
                    {sidebarOpen && (
                        <Typography variant="caption" sx={{
                            color: systemOnline ? '#4caf50' : '#f44336',
                            fontWeight: 600, letterSpacing: 0.3,
                        }}>
                            {systemOnline ? 'System Online' : 'System Offline'}
                        </Typography>
                    )}
                </Box>
            </Box>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </Box>
    )

    return (
        <>
            {/* Mobile drawer */}
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                }}
            >
                {drawerContent}
            </Drawer>

            {/* Desktop drawer */}
            <Drawer
                variant="permanent"
                sx={{
                    display: { xs: 'none', md: 'block' },
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        boxSizing: 'border-box',
                        width: drawerWidth,
                        transition: 'width 0.3s',
                        overflowX: 'hidden',
                    },
                }}
                open
            >
                {drawerContent}
            </Drawer>
        </>
    )
}

export default Sidebar