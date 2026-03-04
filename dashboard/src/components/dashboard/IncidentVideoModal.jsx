import React, { useState, useRef, useCallback } from 'react';
import {
    Dialog, DialogContent, DialogTitle, Box, Typography, IconButton,
    ToggleButton, ToggleButtonGroup, Chip, Divider, Paper
} from '@mui/material';
import {
    Close as CloseIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
    Smartphone as PhoneIcon,
    FlightTakeoff as DroneIcon,
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const getSeverityColor = (severity) => ({
    'CRITICAL': '#ff4444',
    'HIGH': '#ff8800',
    'MEDIUM': '#ffcc00',
    'LOW': '#00cc00',
}[severity] || '#999');

const IncidentVideoModal = ({ open, onClose, incident }) => {
    const [videoSource, setVideoSource] = useState(['phone']);
    const [fullscreenTarget, setFullscreenTarget] = useState(null);
    const phoneRef = useRef(null);
    const droneRef = useRef(null);
    const splitRef = useRef(null);

    if (!incident) return null;

    const severityColor = getSeverityColor(incident.severity);
    const showPhone = videoSource.includes('phone');
    const showDrone = videoSource.includes('drone');
    const showBoth = showPhone && showDrone;

    const handleSourceChange = (e, newSources) => {
        if (newSources && newSources.length > 0) {
            setVideoSource(newSources);
        }
    };

    const toggleFullscreen = (ref) => {
        if (!document.fullscreenElement) {
            ref.current?.requestFullscreen();
            setFullscreenTarget(ref);
        } else {
            document.exitFullscreen();
            setFullscreenTarget(null);
        }
    };

    const VideoPlaceholder = ({ type, label, refProp }) => (
        <Paper
            ref={refProp}
            sx={{
                flex: 1,
                minHeight: 300,
                background: '#0a0a0a',
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {/* Video header bar */}
            <Box sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                px: 1.5, py: 0.8, background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4444', animation: 'blink 1.5s infinite' }} />
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, letterSpacing: 0.5 }}>
                        {label} — LIVE
                    </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleFullscreen(refProp)} sx={{ color: 'white' }}>
                    <FullscreenIcon fontSize="small" />
                </IconButton>
            </Box>

            {/* Video content area */}
            <Box sx={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: type === 'phone'
                    ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)'
                    : 'radial-gradient(ellipse at center, #0d1b0d 0%, #0a0a0a 70%)',
            }}>
                {type === 'phone' ? (
                    <PhoneIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                ) : (
                    <DroneIcon sx={{ fontSize: 64, color: 'rgba(0,255,0,0.15)', mb: 2 }} />
                )}
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                    {type === 'phone' ? '📱 Phone Stream' : '🚁 Drone Stream'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', mt: 0.5 }}>
                    Waiting for live feed connection...
                </Typography>

                {/* Simulated scan lines */}
                <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
                }} />
            </Box>

            {/* Video footer with metadata */}
            <Box sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                px: 1.5, py: 0.5, background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                    {type === 'phone' ? 'CAM:PHONE-01' : 'CAM:DRONE-01'} | {new Date().toLocaleTimeString()}
                </Typography>
                <Chip label="LIVE" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#ff4444', color: '#fff' }} />
            </Box>
        </Paper>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    background: '#121212',
                    borderRadius: 3,
                    border: `1px solid ${severityColor}33`,
                    minHeight: '70vh',
                }
            }}
        >
            <style>{`
                @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0.3; }
                }
            `}</style>

            {/* Dialog Title Bar */}
            <DialogTitle sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                pb: 1, borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: severityColor, boxShadow: `0 0 8px ${severityColor}` }} />
                        <Typography variant="h6" fontWeight="bold">
                            {incident.title || 'Unknown Incident'}
                        </Typography>
                        <Chip label={incident.severity} size="small" sx={{ bgcolor: `${severityColor}22`, color: severityColor, fontWeight: 700, ml: 1 }} />
                        <Chip label={incident.status} size="small" color="primary" variant="outlined" sx={{ ml: 0.5 }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <LocationIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                                {incident.address || incident.location_name || 'Unknown'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                                {incident.created_at ? formatDistanceToNow(new Date(incident.created_at), { addSuffix: true }) : 'N/A'}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Description */}
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    {incident.description}
                </Typography>

                <Divider />

                {/* Video Source Toggle */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                        📹 Live Video Feed
                    </Typography>
                    <ToggleButtonGroup
                        value={videoSource}
                        onChange={handleSourceChange}
                        size="small"
                        sx={{
                            '& .MuiToggleButton-root': {
                                color: 'rgba(255,255,255,0.5)',
                                borderColor: 'rgba(255,255,255,0.2)',
                                px: 2,
                                '&.Mui-selected': {
                                    color: '#fff',
                                    bgcolor: 'primary.main',
                                },
                            }
                        }}
                    >
                        <ToggleButton value="phone">
                            <PhoneIcon sx={{ fontSize: 18, mr: 0.5 }} /> Phone
                        </ToggleButton>
                        <ToggleButton value="drone">
                            <DroneIcon sx={{ fontSize: 18, mr: 0.5 }} /> Drone
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {/* Video Display Area */}
                <Box sx={{
                    display: 'flex',
                    gap: showBoth ? 1.5 : 0,
                    flex: 1,
                    minHeight: 350,
                    flexDirection: { xs: 'column', md: showBoth ? 'row' : 'column' },
                }}
                    ref={splitRef}
                >
                    {showPhone && (
                        <VideoPlaceholder type="phone" label="📱 Phone Camera" refProp={phoneRef} />
                    )}
                    {showDrone && (
                        <VideoPlaceholder type="drone" label="🚁 Drone Camera" refProp={droneRef} />
                    )}
                    {!showPhone && !showDrone && (
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                            <Typography color="text.secondary">Select a video source above</Typography>
                        </Box>
                    )}
                </Box>

                {/* Fullscreen hint */}
                {(showPhone || showDrone) && (
                    <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: -1 }}>
                        💡 Click the fullscreen icon on any video to expand it
                    </Typography>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default IncidentVideoModal;
