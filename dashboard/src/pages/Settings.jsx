import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Typography,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  Chip,
  Stack,
  Card,
  CardContent,
  CardHeader,
  Avatar,
  IconButton,
  CircularProgress,
} from '@mui/material'
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Security as SecurityIcon,
  Lock as LockIcon,
  Logout as LogoutIcon,
  Delete as DeleteIcon,
  Language as LanguageIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Shield as ShieldIcon,
  Person as PersonIcon,
  Info as InfoIcon,
  Palette as PaletteIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material'
import { setTheme } from '../store/slices/uiSlice'
import { logout } from '../store/slices/authSlice'
import { api } from '../services/api'

const Settings = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { themeMode } = useSelector((state) => state.ui)
  const { user, profile } = useSelector((state) => state.auth)

  const [notifications, setNotifications] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [criticalOnly, setCriticalOnly] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const isDark = themeMode === 'dark'

  const handleThemeToggle = () => {
    dispatch(setTheme(isDark ? 'light' : 'dark'))
  }

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  const handlePasswordChange = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('Passwords do not match')
      return
    }
    if (passwordForm.new_password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    try {
      await api.post('/auth/change-password/', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      setSuccess('Password changed successfully')
      setPasswordDialogOpen(false)
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Settings
      </Typography>

      {/* ─── Appearance ─── */}
      <Card sx={{ mb: 3, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: isDark ? 'warning.main' : 'primary.main' }}><PaletteIcon /></Avatar>}
          title="Appearance"
          titleTypographyProps={{ fontWeight: 600 }}
          subheader="Customize the look and feel"
        />
        <Divider />
        <List disablePadding>
          <ListItem sx={{ px: 3, py: 2 }}>
            <ListItemIcon>
              {isDark ? <DarkModeIcon /> : <LightModeIcon sx={{ color: '#ffb300' }} />}
            </ListItemIcon>
            <ListItemText
              primary="Dark Mode"
              secondary={isDark ? 'Currently using dark theme' : 'Currently using light theme'}
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={isDark}
                onChange={handleThemeToggle}
                color="primary"
              />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Card>

      {/* ─── Notifications ─── */}
      <Card sx={{ mb: 3, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: 'info.main' }}><NotificationsIcon /></Avatar>}
          title="Notifications"
          titleTypographyProps={{ fontWeight: 600 }}
          subheader="Manage alert preferences"
        />
        <Divider />
        <List disablePadding>
          <ListItem sx={{ px: 3, py: 2 }}>
            <ListItemIcon>
              {notifications ? <NotificationsIcon color="info" /> : <NotificationsOffIcon />}
            </ListItemIcon>
            <ListItemText
              primary="Push Notifications"
              secondary="Receive real-time alerts for incidents"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={notifications}
                onChange={() => setNotifications(!notifications)}
                color="info"
              />
            </ListItemSecondaryAction>
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem sx={{ px: 3, py: 2 }}>
            <ListItemIcon>
              {soundEnabled ? <VolumeUpIcon color="info" /> : <VolumeOffIcon />}
            </ListItemIcon>
            <ListItemText
              primary="Alert Sounds"
              secondary="Play sound for critical alerts"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={soundEnabled}
                onChange={() => setSoundEnabled(!soundEnabled)}
                color="info"
              />
            </ListItemSecondaryAction>
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem sx={{ px: 3, py: 2 }}>
            <ListItemIcon>
              <ShieldIcon color={criticalOnly ? 'error' : 'inherit'} />
            </ListItemIcon>
            <ListItemText
              primary="Critical Alerts Only"
              secondary="Only show critical severity notifications"
            />
            <ListItemSecondaryAction>
              <Switch
                edge="end"
                checked={criticalOnly}
                onChange={() => setCriticalOnly(!criticalOnly)}
                color="error"
              />
            </ListItemSecondaryAction>
          </ListItem>
        </List>
      </Card>

      {/* ─── Security ─── */}
      <Card sx={{ mb: 3, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: 'success.main' }}><SecurityIcon /></Avatar>}
          title="Security"
          titleTypographyProps={{ fontWeight: 600 }}
          subheader="Account security settings"
        />
        <Divider />
        <List disablePadding>
          <ListItem
            sx={{ px: 3, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setPasswordDialogOpen(true)}
          >
            <ListItemIcon>
              <LockIcon />
            </ListItemIcon>
            <ListItemText
              primary="Change Password"
              secondary="Update your login password"
            />
            <Chip label="Update" size="small" variant="outlined" />
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem sx={{ px: 3, py: 2 }}>
            <ListItemIcon>
              <ShieldIcon color="success" />
            </ListItemIcon>
            <ListItemText
              primary="Two-Factor Authentication"
              secondary="Add extra security to your account"
            />
            <Chip label="Coming Soon" size="small" color="default" />
          </ListItem>
        </List>
      </Card>

      {/* ─── Account ─── */}
      <Card sx={{ mb: 3, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <CardHeader
          avatar={<Avatar sx={{ bgcolor: 'error.main' }}><PersonIcon /></Avatar>}
          title="Account"
          titleTypographyProps={{ fontWeight: 600 }}
          subheader="Session and account management"
        />
        <Divider />
        <List disablePadding>
          <ListItem sx={{ px: 3, py: 2 }}>
            <ListItemIcon>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText
              primary="Logged in as"
              secondary={profile?.email || user?.username || '—'}
            />
            {profile?.role && (
              <Chip label={profile.role.replace(/_/g, ' ')} size="small" color="primary" variant="outlined" />
            )}
          </ListItem>
          <Divider variant="inset" component="li" />
          <ListItem
            sx={{ px: 3, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setLogoutDialogOpen(true)}
          >
            <ListItemIcon>
              <LogoutIcon color="error" />
            </ListItemIcon>
            <ListItemText
              primary={<Typography color="error.main" fontWeight={600}>Sign Out</Typography>}
              secondary="Log out of your account on this device"
            />
          </ListItem>
        </List>
      </Card>

      {/* ─── App Info ─── */}
      <Paper sx={{ p: 3, borderRadius: 3, border: 1, borderColor: 'divider', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          HelpNet Command Center &middot; v1.0.0
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Emergency Response Management System
        </Typography>
      </Paper>

      {/* ─── Logout Dialog ─── */}
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
            onClick={handleLogout}
            variant="contained"
            color="error"
            startIcon={<LogoutIcon />}
            sx={{ borderRadius: 2 }}
          >
            Sign Out
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Change Password Dialog ─── */}
      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, minWidth: 420 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon color="primary" /> Change Password
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Current Password"
              type="password"
              fullWidth
              value={passwordForm.old_password}
              onChange={(e) => setPasswordForm((p) => ({ ...p, old_password: e.target.value }))}
              autoComplete="current-password"
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm((p) => ({ ...p, new_password: e.target.value }))}
              autoComplete="new-password"
              helperText="At least 8 characters"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))}
              autoComplete="new-password"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPasswordDialogOpen(false)} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handlePasswordChange}
            variant="contained"
            disabled={changingPassword || !passwordForm.old_password || !passwordForm.new_password}
            startIcon={changingPassword ? <CircularProgress size={18} color="inherit" /> : <LockIcon />}
            sx={{ borderRadius: 2 }}
          >
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Snackbars ─── */}
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ borderRadius: 2 }}>
          {success}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default Settings
