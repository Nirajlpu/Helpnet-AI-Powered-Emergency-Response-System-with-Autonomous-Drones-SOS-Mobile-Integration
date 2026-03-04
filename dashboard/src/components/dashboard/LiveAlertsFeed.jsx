import React from 'react';
import { useSelector } from 'react-redux';
import { Paper, Typography, Box, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import { NotificationsActive as AlertIcon } from '@mui/icons-material';

const LiveAlertsFeed = () => {
    const { alerts } = useSelector((state) => state.ui);

    // Filter or map alerts to show them as a feed. If alerts are empty, we might use incidents as fallback.
    const { items: incidents } = useSelector((state) => state.incidents);

    // If no explicit UI alerts, let's create a feed from recent incident creations/updates to simulate live AI feed
    const feedItems = alerts.length > 0 ? alerts : incidents.slice(0, 10).map(inc => ({
        id: inc.id,
        title: inc.title || inc.severity === 'CRITICAL' ? 'Emergency Call' : inc.type || 'Detection Event',
        time: new Date(inc.created_at).toLocaleTimeString([], { hour12: false }),
        message: inc.description
    }));

    return (
        <Paper sx={{ height: '100%', p: 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                    Live AI Alerts
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Real-time detection feed
                </Typography>
            </Box>

            <List sx={{ overflowY: 'auto', flex: 1 }}>
                {feedItems.map((item, index) => (
                    <ListItem
                        key={item.id || index}
                        sx={{
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            py: 1.5,
                            '&:last-child': { borderBottom: 0 }
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                            <AlertIcon color={index === 0 ? "error" : "action"} />
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                <Typography variant="subtitle2" fontWeight="bold">
                                    {item.title || item.message || 'New Alert'}
                                </Typography>
                            }
                            secondary={
                                <Typography variant="caption" color="text.secondary">
                                    New incident detected by AI system
                                </Typography>
                            }
                        />
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            {item.time || new Date().toLocaleTimeString([], { hour12: false })}
                        </Typography>
                    </ListItem>
                ))}
                {feedItems.length === 0 && (
                    <Typography color="text.secondary" align="center" sx={{ mt: 4 }}>
                        No live alerts at this time.
                    </Typography>
                )}
            </List>
        </Paper>
    );
};

export default LiveAlertsFeed;
