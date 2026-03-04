import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
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
} from '@mui/material'
import {
    Notifications as NotificationsIcon,
    AccountCircle,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
} from '@mui/icons-material'
import { toggleTheme } from '../../store/slices/uiSlice'

const TopBar = () => {
    const dispatch = useDispatch()
    const { alerts, themeMode } = useSelector((state) => state.ui)
    const [anchorEl, setAnchorEl] = useState(null)

    const handleMenu = (event) => setAnchorEl(event.currentTarget)
    const handleClose = () => setAnchorEl(null)

    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length
    const isDark = themeMode === 'dark'

    return (
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
                    <IconButton onClick={handleMenu} color="inherit">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                            <AccountCircle />
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    >
                        <MenuItem onClick={handleClose}>Profile</MenuItem>
                        <MenuItem onClick={handleClose}>Settings</MenuItem>
                        <MenuItem onClick={handleClose}>Logout</MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    )
}

export default TopBar