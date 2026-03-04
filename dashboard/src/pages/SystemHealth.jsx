import React from 'react';
import {
    Box, Typography, Paper, Grid, Chip, LinearProgress, Divider
} from '@mui/material';
import {
    CheckCircle as HealthyIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Storage as ServerIcon,
    Cloud as CloudIcon,
    Wifi as NetworkIcon,
    Memory as CpuIcon,
    SdStorage as StorageIcon,
    Api as ApiIcon,
    SmartToy as AiIcon,
    Videocam as StreamIcon,
    Security as SecurityIcon,
} from '@mui/icons-material';

const systemServices = [
    {
        name: 'Backend API Server',
        status: 'healthy',
        uptime: '99.98%',
        responseTime: '42ms',
        icon: ServerIcon,
        description: 'Core REST API handling all requests',
    },
    {
        name: 'Database (PostgreSQL)',
        status: 'healthy',
        uptime: '99.99%',
        responseTime: '8ms',
        icon: StorageIcon,
        description: 'Primary data store for incidents, users, and drones',
    },
    {
        name: 'WebSocket Server',
        status: 'healthy',
        uptime: '99.95%',
        responseTime: '12ms',
        icon: NetworkIcon,
        description: 'Real-time incident and drone position updates',
    },
    {
        name: 'Drone Communication Hub',
        status: 'warning',
        uptime: '98.50%',
        responseTime: '156ms',
        icon: CloudIcon,
        description: 'Manages drone telemetry and command relay',
    },
    {
        name: 'Video Streaming Service',
        status: 'healthy',
        uptime: '99.90%',
        responseTime: '85ms',
        icon: StreamIcon,
        description: 'Phone and drone live video feed processing',
    },
    {
        name: 'AI Incident Detection',
        status: 'healthy',
        uptime: '99.80%',
        responseTime: '230ms',
        icon: AiIcon,
        description: 'ML model for auto-detecting and classifying incidents',
    },
    {
        name: 'Notification Service',
        status: 'degraded',
        uptime: '97.20%',
        responseTime: '320ms',
        icon: ApiIcon,
        description: 'Push notifications, SMS, and email alerts',
    },
    {
        name: 'Authentication & Security',
        status: 'healthy',
        uptime: '99.99%',
        responseTime: '15ms',
        icon: SecurityIcon,
        description: 'JWT auth, role-based access control',
    },
];

const resourceMetrics = [
    { label: 'CPU Usage', value: 42, color: '#4caf50' },
    { label: 'Memory Usage', value: 68, color: '#ff9800' },
    { label: 'Disk Usage', value: 35, color: '#2196f3' },
    { label: 'Network I/O', value: 23, color: '#9c27b0' },
];

const getStatusConfig = (status) => ({
    'healthy': { color: '#4caf50', label: '✅ Healthy', icon: HealthyIcon, bg: 'rgba(76, 175, 80, 0.08)' },
    'warning': { color: '#ff9800', label: '⚠️ Warning', icon: WarningIcon, bg: 'rgba(255, 152, 0, 0.08)' },
    'degraded': { color: '#ff5722', label: '🔶 Degraded', icon: WarningIcon, bg: 'rgba(255, 87, 34, 0.08)' },
    'down': { color: '#f44336', label: '❌ Down', icon: ErrorIcon, bg: 'rgba(244, 67, 54, 0.08)' },
}[status] || { color: '#999', label: 'Unknown', icon: ErrorIcon, bg: 'transparent' });

const SystemHealth = () => {
    const healthyCount = systemServices.filter(s => s.status === 'healthy').length;
    const totalCount = systemServices.length;
    const overallHealth = Math.round((healthyCount / totalCount) * 100);

    return (
        <Box sx={{ p: 3 }}>
            {/* Page Header */}
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                🩺 System Health Check
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Real-time monitoring of all HelpNet infrastructure services
            </Typography>

            {/* Overall Health Banner */}
            <Paper sx={{
                p: 3, mb: 3, borderRadius: 3,
                background: overallHealth >= 90
                    ? 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(76,175,80,0.03) 100%)'
                    : 'linear-gradient(135deg, rgba(255,152,0,0.15) 0%, rgba(255,152,0,0.03) 100%)',
                borderLeft: `4px solid ${overallHealth >= 90 ? '#4caf50' : '#ff9800'}`,
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h5" fontWeight="bold">
                            Overall System Health: {overallHealth}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {healthyCount}/{totalCount} services operational • Last checked: {new Date().toLocaleTimeString()}
                        </Typography>
                    </Box>
                    <Chip
                        label={overallHealth >= 90 ? '✅ Operational' : '⚠️ Partial Issues'}
                        sx={{
                            bgcolor: overallHealth >= 90 ? 'rgba(76,175,80,0.2)' : 'rgba(255,152,0,0.2)',
                            color: overallHealth >= 90 ? '#4caf50' : '#ff9800',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            height: 36,
                        }}
                    />
                </Box>
            </Paper>

            {/* Resource Metrics */}
            <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                    📊 Resource Utilization
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {resourceMetrics.map(metric => (
                        <Box key={metric.label} sx={{ flex: '1 1 200px', minWidth: 180 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
                                <Typography variant="body2" fontWeight="bold" sx={{ color: metric.color }}>{metric.value}%</Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={metric.value}
                                sx={{
                                    height: 8, borderRadius: 4,
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    '& .MuiLinearProgress-bar': { bgcolor: metric.color, borderRadius: 4 },
                                }}
                            />
                        </Box>
                    ))}
                </Box>
            </Paper>

            <Divider sx={{ mb: 3 }} />

            {/* Service Cards */}
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                🔧 Service Status
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                {systemServices.map(service => {
                    const config = getStatusConfig(service.status);
                    const Icon = service.icon;
                    return (
                        <Paper
                            key={service.name}
                            sx={{
                                p: 2.5, borderRadius: 2, background: config.bg,
                                borderLeft: `4px solid ${config.color}`,
                                transition: 'all 0.2s ease',
                                '&:hover': { boxShadow: `0 0 12px ${config.color}22`, transform: 'translateY(-2px)' },
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                    <Icon sx={{ color: config.color, mt: 0.3 }} />
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="bold">{service.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{service.description}</Typography>
                                    </Box>
                                </Box>
                                <Chip label={config.label} size="small" sx={{ bgcolor: `${config.color}22`, color: config.color, fontWeight: 600, fontSize: '0.7rem' }} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Uptime</Typography>
                                    <Typography variant="body2" fontWeight="bold">{service.uptime}</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Response</Typography>
                                    <Typography variant="body2" fontWeight="bold">{service.responseTime}</Typography>
                                </Box>
                            </Box>
                        </Paper>
                    );
                })}
            </Box>
        </Box>
    );
};

export default SystemHealth;
