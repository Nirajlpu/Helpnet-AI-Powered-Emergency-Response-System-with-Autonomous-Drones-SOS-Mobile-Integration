import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login, register, setDevAuth, clearError } from '@store/slices/authSlice.js'
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Alert,
    Divider,
    InputAdornment,
    IconButton,
    CircularProgress,
    Fade,
    Collapse,
    Stack,
    Chip,
    Link,
} from '@mui/material'
import {
    Security as SecurityIcon,
    Person as PersonIcon,
    Lock as LockIcon,
    Email as EmailIcon,
    Visibility,
    VisibilityOff,
    Login as LoginIcon,
    PersonAdd as PersonAddIcon,
    ArrowBack as ArrowBackIcon,
    CheckCircle as CheckCircleIcon,
    Badge as BadgeIcon,
} from '@mui/icons-material'

const Login = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { isLoading, error } = useSelector((state) => state.auth)

    const [mode, setMode] = useState('login') // 'login' | 'register'
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    // Login form
    const [credentials, setCredentials] = useState({ username: '', password: '' })
    const loginIsEmail = credentials.username.includes('@')

    // Register form
    const [regForm, setRegForm] = useState({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    })
    const [regError, setRegError] = useState(null)

    const handleLoginChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value })
    }

    const handleRegChange = (e) => {
        setRegForm({ ...regForm, [e.target.name]: e.target.value })
        if (regError) setRegError(null)
    }

    const handleLoginSubmit = async (e) => {
        e.preventDefault()
        const result = await dispatch(login(credentials))
        if (login.fulfilled.match(result)) {
            navigate('/')
        }
    }

    const handleRegisterSubmit = async (e) => {
        e.preventDefault()
        setRegError(null)

        // Validation
        if (regForm.username.length < 3) {
            setRegError('Username must be at least 3 characters')
            return
        }
        if (!regForm.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regForm.email)) {
            setRegError('Please enter a valid email address')
            return
        }
        if (regForm.password.length < 8) {
            setRegError('Password must be at least 8 characters')
            return
        }
        if (regForm.password !== regForm.confirmPassword) {
            setRegError('Passwords do not match')
            return
        }

        const result = await dispatch(register({
            first_name: regForm.firstName.trim(),
            last_name: regForm.lastName.trim(),
            username: regForm.username,
            email: regForm.email,
            password: regForm.password,
        }))
        if (register.fulfilled.match(result)) {
            navigate('/')
        }
    }

    const switchMode = (newMode) => {
        setMode(newMode)
        dispatch(clearError())
        setRegError(null)
        setShowPassword(false)
        setShowConfirmPassword(false)
    }

    const handleDemoMode = () => {
        dispatch(setDevAuth())
        navigate('/')
    }

    const displayError = mode === 'register' ? (regError || error) : error

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.default',
                background: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'radial-gradient(ellipse at 50% 0%, rgba(255,68,68,0.08) 0%, transparent 60%), #121212'
                        : 'radial-gradient(ellipse at 50% 0%, rgba(211,47,47,0.06) 0%, transparent 60%), #f5f5f5',
                py: 4,
            }}
        >
            <Container component="main" maxWidth="xs">
                <Fade in timeout={600}>
                    <Paper
                        elevation={mode === 'login' ? 8 : 12}
                        sx={{
                            p: { xs: 3, sm: 4 },
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: '100%',
                            borderRadius: 4,
                            border: 1,
                            borderColor: 'divider',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Top accent bar */}
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 4,
                                background: 'linear-gradient(90deg, #ff4444, #ff7777, #ff4444)',
                            }}
                        />

                        {/* Logo */}
                        <Box
                            sx={{
                                mt: 2,
                                mb: 1,
                                width: 64,
                                height: 64,
                                bgcolor: 'primary.main',
                                borderRadius: 3,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 20px rgba(255,68,68,0.3)',
                            }}
                        >
                            <SecurityIcon sx={{ fontSize: 36, color: 'white' }} />
                        </Box>

                        <Typography variant="h5" sx={{ fontWeight: 800, mt: 1, letterSpacing: -0.5 }}>
                            HelpNet
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            {mode === 'login' ? 'Command Center Access' : 'Create Your Account'}
                        </Typography>

                        {/* Error */}
                        <Collapse in={!!displayError} sx={{ width: '100%' }}>
                            <Alert
                                severity="error"
                                sx={{ mb: 2, borderRadius: 2 }}
                                onClose={() => {
                                    dispatch(clearError())
                                    setRegError(null)
                                }}
                            >
                                {displayError}
                            </Alert>
                        </Collapse>

                        {/* ─── LOGIN FORM ─── */}
                        {mode === 'login' && (
                            <Fade in timeout={400}>
                                <Box component="form" onSubmit={handleLoginSubmit} sx={{ width: '100%' }}>
                                    <TextField
                                        fullWidth
                                        required
                                        name="username"
                                        label="Username or Email"
                                        autoComplete="username email"
                                        autoFocus
                                        value={credentials.username}
                                        onChange={handleLoginChange}
                                        placeholder="Enter your username or email"
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        {loginIsEmail
                                                            ? <EmailIcon fontSize="small" color="action" />
                                                            : <PersonIcon fontSize="small" color="action" />}
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                    <TextField
                                        fullWidth
                                        required
                                        name="password"
                                        label="Access Code"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        value={credentials.password}
                                        onChange={handleLoginChange}
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LockIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                        >
                                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />

                                    <Button
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        disabled={isLoading}
                                        startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
                                        sx={{
                                            py: 1.5,
                                            borderRadius: 2,
                                            fontWeight: 700,
                                            fontSize: '0.95rem',
                                            textTransform: 'none',
                                            boxShadow: '0 4px 12px rgba(255,68,68,0.25)',
                                            '&:hover': { boxShadow: '0 6px 20px rgba(255,68,68,0.35)' },
                                        }}
                                    >
                                        {isLoading ? 'Authenticating...' : 'Sign In'}
                                    </Button>

                                    <Divider sx={{ my: 2.5 }}>
                                        <Chip label="or" size="small" variant="outlined" />
                                    </Divider>

                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        onClick={handleDemoMode}
                                        sx={{
                                            py: 1.2,
                                            borderRadius: 2,
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            mb: 2,
                                        }}
                                    >
                                        Enter Demo Mode
                                    </Button>

                                    {/* Switch to Register */}
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Don&apos;t have an account?{' '}
                                            <Link
                                                component="button"
                                                type="button"
                                                variant="body2"
                                                onClick={() => switchMode('register')}
                                                sx={{ fontWeight: 700, cursor: 'pointer' }}
                                                underline="hover"
                                            >
                                                Create Account
                                            </Link>
                                        </Typography>
                                    </Box>
                                </Box>
                            </Fade>
                        )}

                        {/* ─── REGISTER FORM ─── */}
                        {mode === 'register' && (
                            <Fade in timeout={400}>
                                <Box component="form" onSubmit={handleRegisterSubmit} sx={{ width: '100%' }}>
                                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                                        <TextField
                                            fullWidth
                                            required
                                            name="firstName"
                                            label="First Name"
                                            autoComplete="given-name"
                                            autoFocus
                                            value={regForm.firstName}
                                            onChange={handleRegChange}
                                            slotProps={{
                                                input: {
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <PersonIcon fontSize="small" color="action" />
                                                        </InputAdornment>
                                                    ),
                                                },
                                            }}
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        />
                                        <TextField
                                            fullWidth
                                            required
                                            name="lastName"
                                            label="Last Name"
                                            autoComplete="family-name"
                                            value={regForm.lastName}
                                            onChange={handleRegChange}
                                            slotProps={{
                                                input: {
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <BadgeIcon fontSize="small" color="action" />
                                                        </InputAdornment>
                                                    ),
                                                },
                                            }}
                                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        />
                                    </Stack>
                                    <TextField
                                        fullWidth
                                        required
                                        name="username"
                                        label="Username"
                                        autoComplete="username"
                                        value={regForm.username}
                                        onChange={handleRegChange}
                                        helperText="At least 3 characters — this will be your login ID"
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <PersonIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                    <TextField
                                        fullWidth
                                        required
                                        name="email"
                                        label="Email Address"
                                        type="email"
                                        autoComplete="email"
                                        value={regForm.email}
                                        onChange={handleRegChange}
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <EmailIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                    <TextField
                                        fullWidth
                                        required
                                        name="password"
                                        label="Password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={regForm.password}
                                        onChange={handleRegChange}
                                        helperText="At least 8 characters"
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LockIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                        >
                                                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                    <TextField
                                        fullWidth
                                        required
                                        name="confirmPassword"
                                        label="Confirm Password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        value={regForm.confirmPassword}
                                        onChange={handleRegChange}
                                        error={
                                            regForm.confirmPassword.length > 0 &&
                                            regForm.password !== regForm.confirmPassword
                                        }
                                        helperText={
                                            regForm.confirmPassword.length > 0 &&
                                            regForm.password !== regForm.confirmPassword
                                                ? 'Passwords do not match'
                                                : ' '
                                        }
                                        slotProps={{
                                            input: {
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <LockIcon fontSize="small" color="action" />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        {regForm.confirmPassword.length > 0 &&
                                                         regForm.password === regForm.confirmPassword ? (
                                                            <CheckCircleIcon fontSize="small" color="success" />
                                                        ) : (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                                edge="end"
                                                            >
                                                                {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                            </IconButton>
                                                        )}
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />

                                    <Button
                                        type="submit"
                                        fullWidth
                                        variant="contained"
                                        disabled={isLoading}
                                        startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <PersonAddIcon />}
                                        sx={{
                                            py: 1.5,
                                            borderRadius: 2,
                                            fontWeight: 700,
                                            fontSize: '0.95rem',
                                            textTransform: 'none',
                                            boxShadow: '0 4px 12px rgba(255,68,68,0.25)',
                                            '&:hover': { boxShadow: '0 6px 20px rgba(255,68,68,0.35)' },
                                        }}
                                    >
                                        {isLoading ? 'Creating Account...' : 'Create Account'}
                                    </Button>

                                    {/* Switch to Login */}
                                    <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Already have an account?{' '}
                                            <Link
                                                component="button"
                                                type="button"
                                                variant="body2"
                                                onClick={() => switchMode('login')}
                                                sx={{ fontWeight: 700, cursor: 'pointer' }}
                                                underline="hover"
                                            >
                                                Sign In
                                            </Link>
                                        </Typography>
                                    </Box>
                                </Box>
                            </Fade>
                        )}

                        {/* Footer */}
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 3, textAlign: 'center' }}>
                            HelpNet Emergency Response System &middot; Authorized Personnel Only
                        </Typography>
                    </Paper>
                </Fade>
            </Container>
        </Box>
    )
}

export default Login