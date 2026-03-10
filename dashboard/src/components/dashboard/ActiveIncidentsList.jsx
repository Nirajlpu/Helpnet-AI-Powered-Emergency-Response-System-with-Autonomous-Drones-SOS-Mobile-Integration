import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    Paper, Typography, Box, Chip, Card, CardContent, CircularProgress, Divider,
    TextField, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import {
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
    Warning as WarningIcon,
    FilterList as FilterIcon,
    Person as PersonIcon,
    Category as CategoryIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Prefetch the video page chunk so new tab opens faster
const prefetchVideoPage = () => import('../../pages/IncidentVideoPage.jsx');

const incidentTypeLabel = (type) => ({
    'FIRE': '🔥 Fire', 'MEDICAL': '🏥 Medical', 'ACCIDENT': '💥 Accident',
    'ROAD_ACCIDENT': '🚗 Road Accident', 'FLOOD': '🌊 Flood', 'EARTHQUAKE': '🌍 Earthquake',
    'LANDSLIDE': '⛰️ Landslide', 'STORM': '🌪️ Storm', 'CHEMICAL_SPILL': '☣️ Chemical Spill',
    'INDUSTRIAL_ACCIDENT': '🏭 Industrial', 'CRIME': '🚨 Crime', 'TERRORIST_ATTACK': '💣 Terror Attack',
    'BOMB_THREAT': '💣 Bomb Threat', 'NATURAL_DISASTER': '🌋 Natural Disaster',
    'NUCLEAR_LEAK': '☢️ Nuclear Leak', 'BIOLOGICAL_HAZARD': '🦠 Bio Hazard',
    'WILDFIRE': '🔥 Wildfire', 'TSUNAMI': '🌊 Tsunami', 'OTHER': '📋 Other',
}[type] || type);

const ActiveIncidentsList = () => {
    const { items: incidents, isLoading } = useSelector((state) => state.incidents);

    // Prefetch video page on mount
    useEffect(() => { prefetchVideoPage(); }, []);

    // Filter state
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    const activeIncidents = (incidents || []).filter(inc => inc.status !== 'RESOLVED');

    // Apply filters
    const filteredIncidents = activeIncidents.filter(inc => {
        // Date range filter
        if (dateFrom || dateTo) {
            const created = new Date(inc.created_at);
            if (dateFrom && created < new Date(dateFrom)) return false;
            if (dateTo && created > new Date(dateTo)) return false;
        }
        // Severity filter
        if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
        // Status filter
        if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
        // Type filter (based on title keywords)
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
    });

    const getStatusColor = (status) => ({
        'REPORTED': 'default',
        'DISPATCHED': 'primary',
        'EN_ROUTE': 'info',
        'ON_SCENE': 'success',
        'RESOLVED': 'success',
    }[status] || 'default');

    const getSeverityStyle = (severity) => ({
        'CRITICAL': { bg: 'rgba(255, 68, 68, 0.12)', border: '#ff4444', color: '#ff4444', label: '🔴 CRITICAL' },
        'HIGH': { bg: 'rgba(255, 136, 0, 0.12)', border: '#ff8800', color: '#ff8800', label: '🟠 HIGH' },
        'MEDIUM': { bg: 'rgba(255, 204, 0, 0.12)', border: '#ffcc00', color: '#ccaa00', label: '🟡 MEDIUM' },
        'LOW': { bg: 'rgba(0, 204, 0, 0.12)', border: '#00cc00', color: '#00cc00', label: '🟢 LOW' },
    }[severity] || { bg: 'transparent', border: '#666', color: '#999', label: 'UNKNOWN' });

    const getStatusLabel = (status) => ({
        'REPORTED': '📋 Reported',
        'DISPATCHED': '🚨 Dispatched',
        'EN_ROUTE': '🚗 En Route',
        'ON_SCENE': '👨‍🚒 On Scene',
        'RESOLVED': '✅ Resolved',
    }[status] || status);

    const selectSx = {
        minWidth: 100,
        '& .MuiSelect-select': { py: 0.8, fontSize: '0.8rem' },
        '& .MuiInputLabel-root': { fontSize: '0.8rem' },
    };

    if (isLoading) {
        return (
            <Paper sx={{ p: 3, display: 'flex', justifyContent: 'center', height: '100%', alignItems: 'center' }}>
                <CircularProgress />
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="error" fontSize="small" />
                    <Typography variant="h6" fontWeight="bold">
                        Active Incidents
                    </Typography>
                </Box>
                <Chip
                    label={`${filteredIncidents.length}/${activeIncidents.length} shown`}
                    size="small"
                    color={filteredIncidents.length > 0 ? 'error' : 'default'}
                    variant={filteredIncidents.length > 0 ? 'filled' : 'outlined'}
                />
            </Box>

            {/* Filter Bar */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <FilterIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 0.5 }} />

                <TextField
                    type="datetime-local"
                    size="small"
                    label="From"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 180, '& .MuiInputBase-input': { py: 0.8, fontSize: '0.8rem' } }}
                />
                <TextField
                    type="datetime-local"
                    size="small"
                    label="To"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 180, '& .MuiInputBase-input': { py: 0.8, fontSize: '0.8rem' } }}
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
                        <MenuItem value="REPORTED">Reported</MenuItem>
                        <MenuItem value="DISPATCHED">Dispatched</MenuItem>
                        <MenuItem value="EN_ROUTE">En Route</MenuItem>
                        <MenuItem value="ON_SCENE">On Scene</MenuItem>
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
            </Box>

            <Divider sx={{ mb: 1.5 }} />

            {/* Incident Cards */}
            <Box sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                pr: 0.5,
                pb: 1,
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: 3 },
                '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.3)' },
            }}>
                {filteredIncidents.map(incident => {
                    const severity = getSeverityStyle(incident.severity);
                    return (
                        <Card
                            key={incident.id}
                            onClick={() => window.open(`/incidents/${incident.id}/video`, '_blank')}
                            sx={{
                                borderLeft: `4px solid ${severity.border}`,
                                background: severity.bg,
                                borderRadius: 2,
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                flexShrink: 0,
                                '&:hover': {
                                    boxShadow: `0 0 12px ${severity.border}33`,
                                    transform: 'translateX(4px)',
                                },
                            }}
                        >
                            <CardContent sx={{ py: 2, px: 2, '&:last-child': { pb: 2 } }}>
                                {/* Top row: severity + status */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ color: severity.color, fontWeight: 700, letterSpacing: 0.5 }}>
                                        {severity.label}
                                    </Typography>
                                    <Chip
                                        label={getStatusLabel(incident.status)}
                                        size="small"
                                        color={getStatusColor(incident.status)}
                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                    />
                                </Box>

                                {/* Title */}
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 0.5, lineHeight: 1.3 }}>
                                    {incident.title || incident.description?.split('.')[0] || 'Unknown Incident'}
                                </Typography>

                                {/* Description */}
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.4 }}>
                                    {incident.description}
                                </Typography>

                                {/* Footer: type + reporter + location + time */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                                    {incident.incident_type && (
                                        <Chip
                                            icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                                            label={incidentTypeLabel(incident.incident_type)}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '0.65rem', height: 22 }}
                                        />
                                    )}
                                    {(incident.reporter_profile_detail || (typeof incident.reporter === 'object' && incident.reporter)) && (() => {
                                        const rep = incident.reporter_profile_detail || incident.reporter;
                                        return (
                                            <Chip
                                                icon={<PersonIcon sx={{ fontSize: 14 }} />}
                                                label={`${rep.name} (${rep.phone})`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ fontSize: '0.65rem', height: 22 }}
                                            />
                                        );
                                    })()}
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
                {filteredIncidents.length === 0 && (
                    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                        <WarningIcon sx={{ fontSize: 48, mb: 1 }} />
                        <Typography color="text.secondary" align="center">
                            No incidents match filters.
                        </Typography>
                        <Typography variant="caption" color="text.secondary" align="center">
                            Try adjusting your filter criteria.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Paper>
    );
};

export default ActiveIncidentsList;
