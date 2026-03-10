import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authService } from '@services/authService.js'

const initialState = {
    user: null,
    profile: null,
    profileFetched: false,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: false,
    error: null,
}

export const login = createAsyncThunk(
    'auth/login',
    async (credentials, { rejectWithValue }) => {
        try {
            const data = await authService.login(credentials)
            // DRF obtain_auth_token returns { token }
            localStorage.setItem('token', data.token)
            return data
        } catch (error) {
            return rejectWithValue(error.response?.data?.non_field_errors?.[0] || error.message)
        }
    }
)

export const register = createAsyncThunk(
    'auth/register',
    async (data, { rejectWithValue }) => {
        try {
            const response = await authService.register(data)
            localStorage.setItem('token', response.token)
            return response
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || error.message)
        }
    }
)

export const fetchProfile = createAsyncThunk(
    'auth/fetchProfile',
    async (_, { rejectWithValue }) => {
        try {
            return await authService.getProfile()
        } catch (error) {
            return rejectWithValue(error.message)
        }
    }
)

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null
            state.profile = null
            state.profileFetched = false
            state.token = null
            state.isAuthenticated = false
            localStorage.removeItem('token')
            // Fire-and-forget logout on server
            authService.logout().catch(() => { })
        },
        clearError: (state) => {
            state.error = null
        },
        // For dev mode — skip login
        setDevAuth: (state) => {
            state.isAuthenticated = true
            state.user = { username: 'dev', id: 0 }
        },
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(login.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(login.fulfilled, (state, action) => {
                state.isLoading = false
                state.isAuthenticated = true
                state.token = action.payload.token
                state.user = { username: action.payload.username || action.payload.user_id }
            })
            .addCase(login.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
            })
            // Register
            .addCase(register.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(register.fulfilled, (state, action) => {
                state.isLoading = false
                state.isAuthenticated = true
                state.token = action.payload.token
                state.user = { username: action.payload.username, id: action.payload.user_id }
            })
            .addCase(register.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
            })
            // Profile
            .addCase(fetchProfile.fulfilled, (state, action) => {
                state.profile = action.payload
                state.profileFetched = true
            })
            .addCase(fetchProfile.rejected, (state) => {
                state.profileFetched = true
            })
    },
})

export const { logout, clearError, setDevAuth } = authSlice.actions
export default authSlice.reducer