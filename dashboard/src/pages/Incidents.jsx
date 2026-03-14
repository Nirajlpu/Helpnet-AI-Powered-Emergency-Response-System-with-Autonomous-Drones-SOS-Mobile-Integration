import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
    Box, Typography, Paper, Chip, Card, CardContent, Divider,
    TextField, MenuItem, Select, FormControl, InputLabel, InputAdornment
} from '@mui/material';
import {
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
    Warning as WarningIcon,
    FilterList as FilterIcon,
    Search as SearchIcon,
    Person as PersonIcon,
    Category as CategoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Map URL filter params to status values
const filterMap = {
    active: '_active',       // special: all non-resolved
    live: '_live',           // special: DISPATCHED + EN_ROUTE
    in_progress: 'ON_SCENE',
    under_review: 'REPORTED',
    resolved: 'RESOLVED',
};

const Incidents = () => {
    const { items: incidents } = useSelector((state) => state.incidents);
    const [searchParams] = useSearchParams();
    const urlFilter = searchParams.get('filter');
    const initialStatus = urlFilter ? (filterMap[urlFilter] || 'all') : 'all';

    const incidentTypeLabel = (type) => ({
        'FIRE': '🔥 Fire', 'MEDICAL': '🏥 Medical', 'ACCIDENT': '💥 Accident',
        'ROAD_ACCIDENT': '🚗 Road Accident', 'FLOOD': '🌊 Flood', 'EARTHQUAKE': '🌍 Earthquake',
        'LANDSLIDE': '⛰️ Landslide', 'STORM': '🌪️ Storm', 'CHEMICAL_SPILL': '☣️ Chemical Spill',
        'INDUSTRIAL_ACCIDENT': '🏭 Industrial', 'CRIME': '🚨 Crime', 'TERRORIST_ATTACK': '💣 Terror Attack',
        'BOMB_THREAT': '💣 Bomb Threat', 'NATURAL_DISASTER': '🌋 Natural Disaster',
        'NUCLEAR_LEAK': '☢️ Nuclear Leak', 'BIOLOGICAL_HAZARD': '🦠 Bio Hazard',
        'WILDFIRE': '🔥 Wildfire', 'TSUNAMI': '🌊 Tsunami', 'OTHER': '📋 Other',
    }[type] || type);

    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState(initialStatus);
    const [typeFilter, setTypeFilter] = useState('all');

    const allIncidents = incidents || [];

    // Apply filters
    const filtered = allIncidents.filter(inc => {
        // Search
        if (search) {
            const q = search.toLowerCase();
            const matchTitle = (inc.title || '').toLowerCase().includes(q);
            const matchDesc = (inc.description || '').toLowerCase().includes(q);
            const matchLoc = (inc.address || inc.location_name || '').toLowerCase().includes(q);
            if (!matchTitle && !matchDesc && !matchLoc) return false;
        }
        // Date range
        if (dateFrom || dateTo) {
            const created = new Date(inc.created_at);
            if (dateFrom && created < new Date(dateFrom)) return false;
            if (dateTo && created > new Date(dateTo)) return false;
        }
        // Severity
        if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
        // Status
        if (statusFilter === '_active' && inc.status === 'RESOLVED') return false;
        if (statusFilter === '_live' && inc.status !== 'DISPATCHED' && inc.status !== 'EN_ROUTE') return false;
        if (statusFilter !== 'all' && statusFilter !== '_active' && statusFilter !== '_live' && inc.status !== statusFilter) return false;
        // Type
        if (typeFilter !== 'all') {
            const title = (inc.title || '').toLowerCase();
            if (typeFilter === 'fire' && !title.includes('fire')) return false;
            if (typeFilter === 'accident' && !title.includes('accident')) return false;
            if (typeFilter === 'medical' && !title.includes('medical')) return false;
            if (typeFilter === 'flood' && !title.includes('flood')) return false;
            if (typeFilter === 'gas' && !title.includes('gas')) return false;
            if (typeFilter === 'other') {
                if (['fire', 'accident', 'medical', 'flood', 'gas'].some(t => title.includes(t))) return false;
            }
        }
        return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const getSeverityStyle = (severity) => ({
        'CRITICAL': { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', label: '🔴 CRITICAL' },
        'HIGH': { bg: 'rgba(255,136,0,0.1)', border: '#ff8800', color: '#ff8800', label: '🟠 HIGH' },
        'MEDIUM': { bg: 'rgba(255,204,0,0.1)', border: '#ffcc00', color: '#ccaa00', label: '🟡 MEDIUM' },
        'LOW': { bg: 'rgba(0,204,0,0.1)', border: '#00cc00', color: '#00cc00', label: '🟢 LOW' },
    }[severity] || { bg: 'transparent', border: '#666', color: '#999', label: 'UNKNOWN' });

    const getStatusLabel = (status) => ({
        'REPORTED': '📋 Reported',
        'DISPATCHED': '🚨 Dispatched',
        'EN_ROUTE': '🚗 En Route',
        'ON_SCENE': '👨‍🚒 On Scene',
        'RESOLVED': '✅ Resolved',
    }[status] || status);

    const getStatusColor = (status) => ({
        'REPORTED': 'default',
        'DISPATCHED': 'primary',
        'EN_ROUTE': 'info',
        'ON_SCENE': 'warning',
        'RESOLVED': 'success',
    }[status] || 'default');

    const selectSx = { minWidth: 120, '& .MuiSelect-select': { py: 1 } };

    const activeCount = allIncidents.filter(i => i.status !== 'RESOLVED').length;
    const resolvedCount = allIncidents.filter(i => i.status === 'RESOLVED').length;

    return (
        <Box sx={{ p: 3, height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
            {/* Page Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight="bold">
                        📋 All Incidents
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Complete history of all incidents — past and present
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={`${activeCount} Active`} color="error" variant="filled" />
                    <Chip label={`${resolvedCount} Resolved`} color="success" variant="outlined" />
                    <Chip label={`${allIncidents.length} Total`} variant="outlined" />
                </Box>
            </Box>

            {/* Filter Bar */}
            <Paper sx={{ p: 2, mb: 2, borderRadius: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <FilterIcon sx={{ color: 'text.secondary' }} />

                <TextField
                    placeholder="Search incidents..."
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ minWidth: 200, flex: '1 1 200px' }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>
                        ),
                    }}
                />

                <TextField
                    type="datetime-local"
                    size="small"
                    label="From"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 190, '& .MuiInputBase-input': { py: 1 } }}
                />
                <TextField
                    type="datetime-local"
                    size="small"
                    label="To"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 190, '& .MuiInputBase-input': { py: 1 } }}
                />

                <FormControl size="small" sx={selectSx}>
                    <InputLabel>Severity</InputLabel>
                    <Select value={severityFilter} label="Severity" onChange={(e) => setSeverityFilter(e.target.value)}>
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="CRITICAL">🔴 Critical</MenuItem>
                        <MenuItem value="HIGH">🟠 High</MenuItem>
                        <MenuItem value="MEDIUM">🟡 Medium</MenuItem>
                        <MenuItem value="LOW">🟢 Low</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={selectSx}>
                    <InputLabel>Status</InputLabel>
                    <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="_active">🔴 Active Only</MenuItem>
                        <MenuItem value="_live">📡 Live Only</MenuItem>
                        <MenuItem value="REPORTED">Reported</MenuItem>
                        <MenuItem value="DISPATCHED">Dispatched</MenuItem>
                        <MenuItem value="EN_ROUTE">En Route</MenuItem>
                        <MenuItem value="ON_SCENE">On Scene</MenuItem>
                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={selectSx}>
                    <InputLabel>Type</InputLabel>
                    <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
                        <MenuItem value="all">All Types</MenuItem>
                        <MenuItem value="fire">🔥 Fire</MenuItem>
                        <MenuItem value="accident">🚗 Accident</MenuItem>
                        <MenuItem value="medical">🏥 Medical</MenuItem>
                        <MenuItem value="flood">🌊 Flood</MenuItem>
                        <MenuItem value="gas">⚠️ Gas Leak</MenuItem>
                        <MenuItem value="other">📋 Other</MenuItem>
                    </Select>
                </FormControl>

                <Chip
                    label={`${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                />
            </Paper>

            {/* Incident List */}
            <Box sx={{
                flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5,
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 3 },
            }}>
                {filtered.map(incident => {
                    const severity = getSeverityStyle(incident.severity);
                    const isResolved = incident.status === 'RESOLVED';
                    return (
                        <Card
                            key={incident.id}
                            onClick={() => window.open(`/incidents/${incident.id}/video`, '_blank')}
                            sx={{
                                borderLeft: `4px solid ${severity.border}`,
                                background: severity.bg,
                                borderRadius: 2,
                                opacity: isResolved ? 0.7 : 1,
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                flexShrink: 0,
                                '&:hover': {
                                    opacity: 1,
                                    boxShadow: `0 0 12px ${severity.border}33`,
                                    transform: 'translateX(4px)',
                                },
                            }}
                        >
                            <CardContent sx={{ py: 2, px: 2.5, '&:last-child': { pb: 2 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="caption" sx={{ color: severity.color, fontWeight: 700 }}>
                                            {severity.label}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            #{incident.id}
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={getStatusLabel(incident.status)}
                                        size="small"
                                        color={getStatusColor(incident.status)}
                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                    />
                                </Box>

                                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                                    {incident.title}
                                </Typography>

                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.5 }}>
                                    {incident.description}
                                </Typography>

                                {/* Type + Reporter */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                    {incident.incident_type && (
                                        <Chip
                                            icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                                            label={incidentTypeLabel(incident.incident_type)}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '0.7rem', height: 22 }}
                                        />
                                    )}
                                    {incident.reporter_profile_detail && (
                                        <Chip
                                            icon={<PersonIcon sx={{ fontSize: 14 }} />}
                                            label={`${incident.reporter_profile_detail.name} (${incident.reporter_profile_detail.phone})`}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '0.7rem', height: 22 }}
                                        />
                                    )}
                                </Box>

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <LocationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {incident.address || incident.location_name || 'Unknown'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {format(new Date(incident.created_at), 'MMM d, yyyy, h:mm a')}
                                        </Typography>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    );
                })}

                {filtered.length === 0 && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, opacity: 0.5 }}>
                        <WarningIcon sx={{ fontSize: 48, mb: 1 }} />
                        <Typography>No incidents match your filters.</Typography>
                        <Typography variant="caption" color="text.secondary">Try adjusting your search or filter criteria.</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Incidents;
