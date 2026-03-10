import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
    AppBar,
    Toolbar,
    IconButton,
    Badge,
    Typography,
    Box,
    Menu,
    MenuItem,
    Avatar,
    Tooltip,
    Divider,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
} from '@mui/material'
import {
    Notifications as NotificationsIcon,
    AccountCircle,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Logout as LogoutIcon,
} from '@mui/icons-material'
import { toggleTheme } from '../../store/slices/uiSlice'
import { logout } from '../../store/slices/authSlice'

const TopBar = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { alerts, themeMode } = useSelector((state) => state.ui)
    const { user, profile } = useSelector((state) => state.auth)
    const [anchorEl, setAnchorEl] = useState(null)
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

    const handleMenu = (event) => setAnchorEl(event.currentTarget)
    const handleClose = () => setAnchorEl(null)

    const handleNavigate = (path) => {
        handleClose()
        navigate(path)
    }

    const handleLogoutClick = () => {
        handleClose()
        setLogoutDialogOpen(true)
    }

    const handleLogoutConfirm = () => {
        setLogoutDialogOpen(false)
        dispatch(logout())
        navigate('/login', { replace: true })
    }

    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length
    const isDark = themeMode === 'dark'

    const displayName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.username
        : user?.username || 'User'
    const avatarLetter = displayName.charAt(0).toUpperCase()

    return (
        <>
            <AppBar position="static" elevation={0}>
                <Toolbar sx={{ justifyContent: 'flex-end', gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ flex: 1, color: 'text.secondary' }}>
                        Command Center
                    </Typography>

                    {/* Theme Toggle */}
                    <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                        <IconButton
                            onClick={() => dispatch(toggleTheme())}
                            sx={{
                                color: isDark ? '#ffcc00' : '#5c6bc0',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    background: isDark ? 'rgba(255,204,0,0.1)' : 'rgba(92,107,192,0.1)',
                                    transform: 'rotate(30deg)',
                                },
                            }}
                        >
                            {isDark ? <LightModeIcon /> : <DarkModeIcon />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Alerts">
                        <IconButton color="inherit">
                            <Badge badgeContent={criticalAlerts} color="error">
                                <NotificationsIcon />
                            </Badge>
                        </IconButton>
                    </Tooltip>

                    <Box>
                        <Tooltip title="Account">
                            <IconButton onClick={handleMenu} sx={{ p: 0.5 }}>
                                <Avatar
                                    src={profile?.avatar || undefined}
                                    sx={{
                                        width: 34,
                                        height: 34,
                                        bgcolor: 'primary.main',
                                        fontSize: '0.875rem',
                                        fontWeight: 700,
                                    }}
                                >
                                    {avatarLetter}
                                </Avatar>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleClose}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            slotProps={{
                                paper: {
                                    sx: {
                                        minWidth: 220,
                                        borderRadius: 2,
                                        mt: 1,
                                        border: 1,
                                        borderColor: 'divider',
                                    },
                                },
                            }}
                        >
                            {/* User Info Header */}
                            <Box sx={{ px: 2, py: 1.5 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {displayName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {profile?.email || user?.username || ''}
                                </Typography>
                            </Box>
                            <Divider />

                            <MenuItem onClick={() => handleNavigate('/profile')} sx={{ py: 1.5 }}>
                                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Profile</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => handleNavigate('/settings')} sx={{ py: 1.5 }}>
                                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                                <ListItemText>Settings</ListItemText>
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleLogoutClick} sx={{ py: 1.5 }}>
                                <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                                <ListItemText sx={{ '& .MuiTypography-root': { color: 'error.main', fontWeight: 600 } }}>
                                    Sign Out
                                </ListItemText>
                            </MenuItem>
                        </Menu>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Logout Confirmation */}
            <Dialog
                open={logoutDialogOpen}
                onClose={() => setLogoutDialogOpen(false)}
                PaperProps={{ sx: { borderRadius: 3, minWidth: 380 } }}
            >
                <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LogoutIcon color="error" /> Sign Out
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to sign out? You will need to log in again to access the command center.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setLogoutDialogOpen(false)} sx={{ borderRadius: 2 }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleLogoutConfirm}
                        variant="contained"
                        color="error"
                        startIcon={<LogoutIcon />}
                        sx={{ borderRadius: 2 }}
                    >
                        Sign Out
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default TopBar