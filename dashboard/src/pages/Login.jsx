import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { login, setDevAuth } from '@store/slices/authSlice.js'
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Paper,
    Alert,
    Divider,
} from '@mui/material'
import { Security as SecurityIcon } from '@mui/icons-material'

const Login = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { isLoading, error } = useSelector((state) => state.auth)
    const [credentials, setCredentials] = useState({
        username: '',
        password: ''
    })

    const handleChange = (e) => {
        setCredentials({
            ...credentials,
            [e.target.name]: e.target.value
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        const result = await dispatch(login(credentials))
        if (login.fulfilled.match(result)) {
            navigate('/')
        }
    }

    const handleDemoMode = () => {
        dispatch(setDevAuth())
        navigate('/')
    }

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        borderRadius: 2
                    }}
                >
                    <Box
                        sx={{
                            backgroundColor: 'primary.main',
                            color: 'white',
                            p: 2,
                            borderRadius: '50%',
                            mb: 2
                        }}
                    >
                        <SecurityIcon sx={{ fontSize: 40 }} />
                    </Box>
                    <Typography component="h1" variant="h5" sx={{ mb: 3, fontWeight: 'bold' }}>
                        HelpNet Command Center
                    </Typography>

                    {error && (
                        <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Operator ID"
                            name="username"
                            autoComplete="username"
                            autoFocus
                            value={credentials.username}
                            onChange={handleChange}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Access Code"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={credentials.password}
                            onChange={handleChange}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={isLoading}
                            sx={{ mt: 3, mb: 2, py: 1.5 }}
                        >
                            {isLoading ? 'Authenticating...' : 'Secure Login'}
                        </Button>
                    </Box>

                    <Divider sx={{ width: '100%', my: 1 }}>or</Divider>

                    <Button
                        fullWidth
                        variant="outlined"
                        color="secondary"
                        onClick={handleDemoMode}
                        sx={{ py: 1.2 }}
                    >
                        🚀 Enter Demo Mode (No Backend)
                    </Button>
                </Paper>
            </Box>
        </Container>
    )
}

export default Login