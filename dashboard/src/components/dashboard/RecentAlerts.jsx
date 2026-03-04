import { Paper, Typography, List, ListItem, ListItemText, ListItemIcon, Chip, Box } from '@mui/material'
import { Warning, ErrorOutline, InfoOutlined } from '@mui/icons-material'
import { useSelector } from 'react-redux'
import { formatDistanceToNow } from 'date-fns'

const severityConfig = {
    CRITICAL: { icon: <ErrorOutline color="error" />, color: 'error' },
    HIGH: { icon: <Warning color="warning" />, color: 'warning' },
    MEDIUM: { icon: <InfoOutlined color="info" />, color: 'info' },
    LOW: { icon: <InfoOutlined color="success" />, color: 'success' }
}

const RecentAlerts = () => {
    const { items: incidents } = useSelector((state) => state.incidents)

    // Get 5 most recent active incidents
    const recentAlerts = [...incidents]
        .filter(inc => inc.status !== 'RESOLVED' && inc.status !== 'FALSE_ALARM')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)

    return (
        <Paper sx={{ height: 500, p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Recent Alerts
            </Typography>

            {recentAlerts.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <Typography color="text.secondary">
                        No active alerts
                    </Typography>
                </Box>
            ) : (
                <List sx={{ overflow: 'auto' }}>
                    {recentAlerts.map((alert) => (
                        <ListItem
                            key={alert.id}
                            alignItems="flex-start"
                            sx={{
                                mb: 1,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                borderLeft: 4,
                                borderColor: `${severityConfig[alert.severity]?.color}.main`
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40, mt: 1 }}>
                                {severityConfig[alert.severity]?.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="subtitle2" component="span">
                                            {alert.location_name || 'Unknown Location'}
                                        </Typography>
                                        <Chip
                                            label={alert.severity}
                                            size="small"
                                            color={severityConfig[alert.severity]?.color}
                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                        />
                                    </Box>
                                }
                                secondary={
                                    <>
                                        <Typography variant="body2" color="text.primary" component="span" sx={{ display: 'block', mb: 0.5 }}>
                                            {alert.description || 'Emergency reported'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                                        </Typography>
                                    </>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Paper>
    )
}

export default RecentAlerts