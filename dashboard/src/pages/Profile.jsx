import { useState, useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Grid,
  TextField,
  Button,
  Divider,
  Chip,
  Skeleton,
  Alert,
  Snackbar,
  IconButton,
  Tab,
  Tabs,
  Card,
  CardContent,
  Stack,
  InputAdornment,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material'
import {
  Person as PersonIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Badge as BadgeIcon,
  CalendarToday as CalendarIcon,
  Shield as ShieldIcon,
  VerifiedUser as VerifiedIcon,
  FamilyRestroom as FamilyIcon,
  CameraAlt as CameraIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Fingerprint as FingerprintIcon,
} from '@mui/icons-material'
import { fetchProfile } from '../store/slices/authSlice'
import { profileService } from '../services/profileService'

const ROLE_COLORS = {
  CIVILIAN: 'default',
  VOLUNTEER: 'info',
  RESPONDER: 'warning',
  POLICE_STATION: 'secondary',
  DISTRICT: 'secondary',
  STATE: 'primary',
  CENTRAL: 'error',
  ADMIN: 'error',
}

const RELATION_OPTIONS = [
  'SPOUSE', 'FATHER', 'MOTHER', 'SON', 'DAUGHTER',
  'BROTHER', 'SISTER', 'GRANDFATHER', 'GRANDMOTHER',
  'UNCLE', 'AUNT', 'COUSIN', 'OTHER',
]

const SEARCH_MODES = [
  { value: 'phone', label: 'Phone', icon: <PhoneIcon fontSize="small" /> },
  { value: 'email', label: 'Email', icon: <EmailIcon fontSize="small" /> },
  { value: 'user_id', label: 'User ID', icon: <FingerprintIcon fontSize="small" /> },
]

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null
}

const ProfileSkeleton = () => (
  <Box>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
      <Skeleton variant="circular" width={96} height={96} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width={200} height={36} />
        <Skeleton variant="text" width={150} height={24} />
      </Box>
    </Box>
    <Grid container spacing={3}>
      {[...Array(6)].map((_, i) => (
        <Grid size={{ xs: 12, md: 6 }} key={i}>
          <Skeleton variant="rounded" height={56} />
        </Grid>
      ))}
    </Grid>
  </Box>
)

const Profile = () => {
  const dispatch = useDispatch()
  const { profile } = useSelector((state) => state.auth)

  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!profile)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formData, setFormData] = useState({})
  const [family, setFamily] = useState([])

  // Family search & add state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [searchMode, setSearchMode] = useState('phone')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedRelation, setSelectedRelation] = useState('')
  const [addingFamily, setAddingFamily] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const searchTimerRef = useRef(null)
  useEffect(() => {
    if (!profile) {
      setLoading(true)
      dispatch(fetchProfile())
        .unwrap()
        .catch((err) => setError(err || 'Failed to load profile'))
        .finally(() => setLoading(false))
    }
  }, [dispatch, profile])

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        age: profile.age || '',
        gender: profile.gender || '',
        village_city: profile.village_city || '',
        district: profile.district || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
      })
      setFamily(profile.family_relations || [])
    }
  }, [profile])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await profileService.update(profile.id, formData)
      dispatch(fetchProfile())
      setEditing(false)
      setSuccess('Profile updated successfully')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        age: profile.age || '',
        gender: profile.gender || '',
        village_city: profile.village_city || '',
        district: profile.district || '',
        state: profile.state || '',
        pincode: profile.pincode || '',
      })
    }
  }

  // ─── Family Management ───

  const refreshFamily = useCallback(async () => {
    if (!profile?.id) return
    try {
      const data = await profileService.getFamily(profile.id)
      setFamily(data)
    } catch {
      // fall back to profile-embedded data
    }
  }, [profile?.id])

  useEffect(() => {
    if (profile?.id && tab === 2) {
      refreshFamily()
    }
  }, [profile?.id, tab, refreshFamily])

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setSearchDone(false)
    setSearchResults([])
    setSelectedUser(null)
    try {
      const results = await profileService.search(searchQuery.trim())
      // Filter out self and existing family members
      const familyUserIds = new Set(family.map((f) => f.to_user))
      const filtered = (Array.isArray(results) ? results : results.results || [])
        .filter((u) => u.id !== profile.id && !familyUserIds.has(u.id))
      setSearchResults(filtered)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setSearching(false)
      setSearchDone(true)
    }
  }

  const handleAddFamily = async () => {
    if (!selectedUser || !selectedRelation) return
    setAddingFamily(true)
    try {
      await profileService.addFamily(profile.id, {
        to_user: selectedUser.id,
        relation: selectedRelation,
      })
      setSuccess(`${selectedUser.first_name} added as ${selectedRelation.replace(/_/g, ' ').toLowerCase()}`)
      setAddDialogOpen(false)
      resetAddDialog()
      refreshFamily()
      dispatch(fetchProfile())
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add family member')
    } finally {
      setAddingFamily(false)
    }
  }

  const handleRemoveFamily = async () => {
    if (!removeTarget) return
    setRemovingId(removeTarget.to_user)
    try {
      await profileService.removeFamily(profile.id, removeTarget.to_user)
      setSuccess(`${removeTarget.to_user_name} removed from family`)
      setRemoveDialogOpen(false)
      setRemoveTarget(null)
      refreshFamily()
      dispatch(fetchProfile())
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove family member')
    } finally {
      setRemovingId(null)
    }
  }

  const resetAddDialog = () => {
    setSearchQuery('')
    setSearchResults([])
    setSearchDone(false)
    setSelectedUser(null)
    setSelectedRelation('')
  }

  const openAddDialog = () => {
    resetAddDialog()
    setAddDialogOpen(true)
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>Profile</Typography>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <ProfileSkeleton />
        </Paper>
      </Box>
    )
  }

  if (!profile && error) {
    return (
      <Box sx={{ maxWidth: 960, mx: 'auto' }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>Profile</Typography>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
      </Box>
    )
  }

  if (!profile) return null

  const fullName = `${profile.first_name} ${profile.last_name}`.trim() || profile.username

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Profile</Typography>
        {!editing ? (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditing(true)}
            sx={{ borderRadius: 2 }}
          >
            Edit Profile
          </Button>
        ) : (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={handleCancel}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={{ borderRadius: 2 }}
            >
              Save Changes
            </Button>
          </Stack>
        )}
      </Box>

      {/* Profile Card Header */}
      <Paper
        sx={{
          p: 4,
          mb: 3,
          borderRadius: 3,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #1e1e1e 0%, #2d1f1f 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #fff5f5 100%)',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={profile.avatar || undefined}
              sx={{
                width: 96,
                height: 96,
                bgcolor: 'primary.main',
                fontSize: '2rem',
                fontWeight: 700,
                border: 3,
                borderColor: 'primary.light',
              }}
            >
              {fullName.charAt(0).toUpperCase()}
            </Avatar>
            {profile.is_verified && (
              <VerifiedIcon
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  color: 'success.main',
                  bgcolor: 'background.paper',
                  borderRadius: '50%',
                  fontSize: 24,
                }}
              />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {fullName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              @{profile.username} &middot; {profile.user_id_code}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label={profile.role?.replace(/_/g, ' ')}
                color={ROLE_COLORS[profile.role] || 'default'}
                size="small"
                icon={<ShieldIcon />}
              />
              {profile.is_volunteer && (
                <Chip label="Volunteer" color="info" size="small" variant="outlined" />
              )}
              {profile.is_verified && (
                <Chip label="Verified" color="success" size="small" variant="outlined" icon={<VerifiedIcon />} />
              )}
            </Stack>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">
              Member since
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
                : '—'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 3, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', minHeight: 48 },
          }}
        >
          <Tab label="Personal Info" icon={<PersonIcon />} iconPosition="start" />
          <Tab label="Address" icon={<LocationIcon />} iconPosition="start" />
          <Tab label="Family" icon={<FamilyIcon />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Personal Info Tab */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="First Name"
                  name="first_name"
                  value={formData.first_name || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" /></InputAdornment> },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Phone"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" /></InputAdornment> },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Age"
                  name="age"
                  type="number"
                  value={formData.age || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><CalendarIcon fontSize="small" /></InputAdornment> },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Gender"
                  name="gender"
                  value={formData.gender || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                  select
                  slotProps={{ select: { native: true } }}
                >
                  <option value="">Select</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </TextField>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Address Tab */}
          <TabPanel value={tab} index={1}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Village / City"
                  name="village_city"
                  value={formData.village_city || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start"><LocationIcon fontSize="small" /></InputAdornment> },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="District"
                  name="district"
                  value={formData.district || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="State"
                  name="state"
                  value={formData.state || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Pincode"
                  name="pincode"
                  value={formData.pincode || ''}
                  onChange={handleChange}
                  disabled={!editing}
                  fullWidth
                />
              </Grid>
            </Grid>
          </TabPanel>

          {/* Family Tab */}
          <TabPanel value={tab} index={2}>
            {/* Header with Add button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Family Members
                {family.length > 0 && (
                  <Chip label={family.length} size="small" sx={{ ml: 1, fontWeight: 700 }} />
                )}
              </Typography>
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={openAddDialog}
                sx={{ borderRadius: 2 }}
              >
                Add Member
              </Button>
            </Box>

            {/* Family Cards */}
            {family.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  textAlign: 'center',
                  py: 8,
                  borderRadius: 3,
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                }}
              >
                <FamilyIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1.5 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>
                  No family members linked
                </Typography>
                <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                  Add family members who are registered on HelpNet
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<PersonAddIcon />}
                  onClick={openAddDialog}
                  sx={{ borderRadius: 2 }}
                >
                  Add Your First Member
                </Button>
              </Paper>
            ) : (
              <Grid container spacing={2}>
                {family.map((rel) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={rel.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderRadius: 3,
                        transition: 'all 0.2s',
                        '&:hover': { boxShadow: 6, borderColor: 'primary.main' },
                        position: 'relative',
                        overflow: 'visible',
                      }}
                    >
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar
                            src={rel.to_user_avatar || undefined}
                            sx={{
                              bgcolor: 'secondary.main',
                              width: 48,
                              height: 48,
                              fontSize: '1.1rem',
                              fontWeight: 700,
                            }}
                          >
                            {(rel.to_user_name || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
                              {rel.to_user_name}
                            </Typography>
                            <Chip
                              label={rel.relation?.replace(/_/g, ' ')}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ mt: 0.5, fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                            />
                          </Box>
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              onClick={() => { setRemoveTarget(rel); setRemoveDialogOpen(true) }}
                              sx={{
                                color: 'text.disabled',
                                '&:hover': { color: 'error.main', bgcolor: 'error.main', backgroundColor: 'rgba(244,67,54,0.08)' },
                              }}
                            >
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        {rel.to_user_phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, pl: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                            <Typography variant="caption" color="text.secondary">
                              {rel.to_user_phone}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </TabPanel>
        </Box>
      </Paper>

      {/* ─── Add Family Member Dialog ─── */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'visible' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <PersonAddIcon color="primary" /> Add Family Member
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {/* Search Mode Toggle */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Search for a HelpNet user by phone number, email, or User ID code.
          </Typography>
          <ToggleButtonGroup
            value={searchMode}
            exclusive
            onChange={(_, v) => { if (v) { setSearchMode(v); setSearchResults([]); setSearchDone(false); setSelectedUser(null) } }}
            size="small"
            sx={{ mb: 2, '& .MuiToggleButton-root': { textTransform: 'none', borderRadius: 2, px: 2 } }}
          >
            {SEARCH_MODES.map((m) => (
              <ToggleButton value={m.value} key={m.value}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {m.icon} {m.label}
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Search Input */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder={
                searchMode === 'phone' ? 'Enter phone number...' :
                  searchMode === 'email' ? 'Enter email address...' :
                    'Enter User ID (e.g. HN-20260307-001)...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {searchMode === 'phone' ? <PhoneIcon fontSize="small" /> :
                        searchMode === 'email' ? <EmailIcon fontSize="small" /> :
                          <FingerprintIcon fontSize="small" />}
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Button
              variant="contained"
              onClick={handleSearchUsers}
              disabled={searching || !searchQuery.trim()}
              sx={{ borderRadius: 2, minWidth: 100 }}
              startIcon={searching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
            >
              Search
            </Button>
          </Box>

          {/* Search Results */}
          {searching && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Searching HelpNet users...
              </Typography>
            </Box>
          )}

          {searchDone && !searching && searchResults.length === 0 && (
            <Paper
              variant="outlined"
              sx={{
                textAlign: 'center',
                py: 4,
                borderRadius: 2,
                borderStyle: 'dashed',
                borderColor: 'warning.main',
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,204,0,0.04)' : 'rgba(255,204,0,0.06)',
              }}
            >
              <PersonIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No HelpNet user found with this {searchMode === 'user_id' ? 'User ID' : searchMode}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Make sure the person is registered on HelpNet
              </Typography>
            </Paper>
          )}

          {searchResults.length > 0 && (
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {searchResults.length} user{searchResults.length > 1 ? 's' : ''} found
              </Typography>
              {searchResults.map((user) => {
                const isSelected = selectedUser?.id === user.id
                const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
                return (
                  <Card
                    key={user.id}
                    variant="outlined"
                    onClick={() => setSelectedUser(isSelected ? null : user)}
                    sx={{
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1,
                      bgcolor: isSelected
                        ? (t) => t.palette.mode === 'dark' ? 'rgba(255,68,68,0.06)' : 'rgba(211,47,47,0.04)'
                        : 'transparent',
                      '&:hover': {
                        borderColor: 'primary.light',
                        boxShadow: 2,
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar
                          src={user.avatar || undefined}
                          sx={{
                            width: 52,
                            height: 52,
                            bgcolor: isSelected ? 'primary.main' : 'secondary.main',
                            fontWeight: 700,
                            fontSize: '1.2rem',
                            border: 2,
                            borderColor: isSelected ? 'primary.light' : 'transparent',
                          }}
                        >
                          {userName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                            {userName}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            {user.user_id_code && (
                              <Chip label={user.user_id_code} size="small" variant="outlined" sx={{ fontSize: '0.68rem', height: 20 }} />
                            )}
                            {user.role && (
                              <Chip
                                label={user.role.replace(/_/g, ' ')}
                                size="small"
                                color={ROLE_COLORS[user.role] || 'default'}
                                sx={{ fontSize: '0.68rem', height: 20 }}
                              />
                            )}
                            {user.is_verified && (
                              <VerifiedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                            )}
                          </Stack>
                          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                            {user.phone && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                <PhoneIcon sx={{ fontSize: 12 }} /> {user.phone}
                              </Typography>
                            )}
                            {user.email && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                <EmailIcon sx={{ fontSize: 12 }} /> {user.email}
                              </Typography>
                            )}
                          </Stack>
                          {(user.village_city || user.district || user.state) && (
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.3 }}>
                              <LocationIcon sx={{ fontSize: 12 }} />
                              {[user.village_city, user.district, user.state].filter(Boolean).join(', ')}
                            </Typography>
                          )}
                        </Box>
                        {isSelected && (
                          <Chip label="Selected" color="primary" size="small" sx={{ fontWeight: 700 }} />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                )
              })}
            </Stack>
          )}

          {/* Relation selector — only when a user is selected */}
          {selectedUser && (
            <Box sx={{ mt: 3 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Select relationship with {selectedUser.first_name || 'this person'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {RELATION_OPTIONS.map((rel) => (
                  <Chip
                    key={rel}
                    label={rel.replace(/_/g, ' ')}
                    onClick={() => setSelectedRelation(rel)}
                    color={selectedRelation === rel ? 'primary' : 'default'}
                    variant={selectedRelation === rel ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: selectedRelation === rel ? 700 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setAddDialogOpen(false)}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddFamily}
            disabled={!selectedUser || !selectedRelation || addingFamily}
            startIcon={addingFamily ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
            sx={{ borderRadius: 2 }}
          >
            Add as {selectedRelation ? selectedRelation.replace(/_/g, ' ') : 'Family'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Remove Confirmation Dialog ─── */}
      <Dialog
        open={removeDialogOpen}
        onClose={() => setRemoveDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, minWidth: 380 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonRemoveIcon color="error" /> Remove Family Member
        </DialogTitle>
        <DialogContent>
          {removeTarget && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 1 }}>
              <Avatar sx={{ bgcolor: 'secondary.main', width: 44, height: 44 }}>
                {(removeTarget.to_user_name || '?').charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {removeTarget.to_user_name}
                </Typography>
                <Chip
                  label={removeTarget.relation?.replace(/_/g, ' ')}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22 }}
                />
              </Box>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to remove this person from your family list? This action can be undone by adding them again.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveDialogOpen(false)} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleRemoveFamily}
            variant="contained"
            color="error"
            disabled={removingId != null}
            startIcon={removingId ? <CircularProgress size={16} color="inherit" /> : <PersonRemoveIcon />}
            sx={{ borderRadius: 2 }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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

export default Profile
