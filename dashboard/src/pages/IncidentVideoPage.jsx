import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    Box, Typography, Chip, Paper, IconButton, Button, Tab, Tabs,
    ToggleButton, ToggleButtonGroup, LinearProgress, Divider
} from '@mui/material';
import {
    Fullscreen as FullscreenIcon,
    Smartphone as PhoneIcon,
    FlightTakeoff as DroneIcon,
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
    Timeline as TimelineIcon,
    Psychology as AiIcon,
    Map as MapIcon,
    Upload as UploadIcon,
    FaceRetouchingNatural as FaceIcon,
    Analytics as AnalyticsIcon,
    CheckCircle as CheckIcon,
    RadioButtonChecked as LiveDot,
    Battery80 as BatteryIcon,
    Speed as SpeedIcon,
    Height as AltitudeIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getSeverityColor = (severity) => ({
    'CRITICAL': '#ff4444',
    'HIGH': '#ff8800',
    'MEDIUM': '#ffcc00',
    'LOW': '#00cc00',
}[severity] || '#999');

// Timeline events generator
const getTimelineEvents = (incident) => {
    const base = new Date(incident.created_at);
    return [
        { time: new Date(base - 0), label: 'Incident Reported', detail: `${incident.title} reported via HelpNet app`, icon: '📋', color: '#ff9800' },
        { time: new Date(base.getTime() + 60000), label: 'Alert Dispatched', detail: 'Emergency alert sent to nearest response unit', icon: '🚨', color: '#f44336' },
        { time: new Date(base.getTime() + 120000), label: 'Drone Dispatched', detail: 'Aerial drone deployed for live reconnaissance', icon: '🚁', color: '#2196f3' },
        { time: new Date(base.getTime() + 180000), label: 'Phone Stream Active', detail: 'Caller phone camera streaming live to command center', icon: '📱', color: '#4caf50' },
        { time: new Date(base.getTime() + 300000), label: 'AI Analysis Started', detail: 'ML model analyzing video feed for threat classification', icon: '🤖', color: '#9c27b0' },
        { time: new Date(base.getTime() + 450000), label: 'Responders En Route', detail: 'First response team dispatched to location', icon: '🚒', color: '#ff5722' },
    ];
};

const IncidentVideoPage = () => {
    const { id } = useParams();
    const { items: incidents } = useSelector((state) => state.incidents || {});
    const { items: drones } = useSelector((state) => state.drones || {});
    const themeMode = useSelector((state) => state.ui.themeMode);
    const incident = (incidents || []).find(inc => String(inc.id) === id);
    const assignedDrone = (drones || []).find(d => Number(d.assignedIncidentId) === Number(incident?.id));


    const [videoSource, setVideoSource] = useState(['phone']);
    const [activeTab, setActiveTab] = useState(0);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const phoneRef = useRef(null);
    const droneRef = useRef(null);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);

    if (!incident) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Typography variant="h5" color="text.secondary">Incident not found</Typography>
            </Box>
        );
    }

    const severityColor = getSeverityColor(incident.severity);
    const showPhone = videoSource.includes('phone');
    const showDrone = videoSource.includes('drone');
    const showBoth = showPhone && showDrone;

    const handleSourceChange = (e, newSources) => {
        if (newSources && newSources.length > 0) setVideoSource(newSources);
    };

    const toggleFullscreen = (ref) => {
        if (!document.fullscreenElement) ref.current?.requestFullscreen();
        else document.exitFullscreen();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setUploadedImage(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const runAnalysis = (type) => {
        setAnalyzing(true);
        setAnalysisResult(null);
        setTimeout(() => {
            setAnalyzing(false);
            if (type === 'face') {
                setAnalysisResult({
                    type: 'Face Detection',
                    results: [
                        { label: 'Faces Detected', value: '3', confidence: 87 },
                        { label: 'Match Found', value: uploadedImage ? 'Partial Match (72%)' : 'No reference image', confidence: uploadedImage ? 72 : 0 },
                        { label: 'Age Range', value: '25–55 years', confidence: 91 },
                    ]
                });
            } else {
                setAnalysisResult({
                    type: 'Scene Analysis',
                    results: [
                        { label: 'Threat Level', value: incident.severity, confidence: 94 },
                        { label: 'Objects Detected', value: 'Vehicle, Debris, Smoke', confidence: 88 },
                        { label: 'People Count', value: '~12 visible', confidence: 79 },
                        { label: 'Area Classification', value: 'Urban Residential', confidence: 96 },
                    ]
                });
            }
        }, 2500);
    };

    const timelineEvents = getTimelineEvents(incident);

    const VideoPanel = ({ type, label, refProp }) => (
        <Paper ref={refProp} sx={{
            flex: 1, background: '#0a0a0a', borderRadius: 2, display: 'flex', flexDirection: 'column',
            position: 'relative', overflow: 'hidden', border: '1px solid', borderColor: 'divider', minHeight: 0,
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#ff4444', animation: 'blink 1.5s infinite' }} />
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>{label} — LIVE</Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleFullscreen(refProp)} sx={{ color: 'white' }}><FullscreenIcon /></IconButton>
            </Box>
            <Box sx={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250,
                background: type === 'phone' ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)' : 'radial-gradient(ellipse at center, #0d1b0d 0%, #0a0a0a 70%)',
            }}>
                {type === 'phone' ? <PhoneIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 1 }} /> : <DroneIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 1 }} />}
                <Typography variant="body2" color="text.secondary">{type === 'phone' ? '📱 Phone Stream' : '🚁 Drone Stream'}</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>Waiting for live feed connection...</Typography>
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 0.8, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>{type === 'phone' ? 'CAM:PHONE-01' : 'CAM:DRONE-01'} | {new Date().toLocaleTimeString()}</Typography>
                <Chip label="LIVE" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#ff4444', color: '#fff' }} />
            </Box>
        </Paper>
    );

    // Live Map component
    const LiveMapPanel = () => {
        const localMapRef = useRef(null);
        const localMapInstance = useRef(null);
        const tileRef = useRef(null);
        const [mapMode, setMapMode] = useState('street'); // 'street' | 'satellite'

        const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        const streetTileUrl = themeMode === 'dark'
            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

        useEffect(() => {
            if (!localMapRef.current || localMapInstance.current) return;

            const [lng, lat] = incident.location?.coordinates || [78.9629, 20.5937];
            const map = L.map(localMapRef.current, { center: [lat, lng], zoom: 14, zoomControl: true, attributionControl: false });
            tileRef.current = L.tileLayer(streetTileUrl, { maxZoom: 19 }).addTo(map);

            // Incident marker
            const incidentIcon = L.divIcon({
                html: `<div style="width:20px;height:20px;background:${severityColor};border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px ${severityColor};animation:pulse-marker 2s infinite"></div>`,
                className: '', iconSize: [20, 20], iconAnchor: [10, 10],
            });
            L.marker([lat, lng], { icon: incidentIcon }).addTo(map)
                .bindPopup(`<b style="color:${severityColor}">${incident.title}</b><br/>${incident.address || ''}`);

            // Drone marker + track
            if (assignedDrone && assignedDrone.location?.coordinates) {
                const [dLng, dLat] = assignedDrone.location.coordinates;
                const droneIcon = L.divIcon({
                    html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:20px;filter:drop-shadow(0 0 6px #2196f3)">🚁</div>`,
                    className: '', iconSize: [28, 28], iconAnchor: [14, 14],
                });
                L.marker([dLat, dLng], { icon: droneIcon }).addTo(map)
                    .bindPopup(`<b>🚁 ${assignedDrone.name}</b><br/>Battery: ${assignedDrone.battery}%<br/>Altitude: ${assignedDrone.altitude}m`);

                // Flight track
                if (assignedDrone.track && assignedDrone.track.length > 0) {
                    const trackCoords = assignedDrone.track.map(([tLng, tLat]) => [tLat, tLng]);
                    L.polyline(trackCoords, { color: '#2196f3', weight: 3, opacity: 0.7, dashArray: '8, 4' }).addTo(map);

                    // Track dots
                    trackCoords.forEach((coord, i) => {
                        L.circleMarker(coord, {
                            radius: 4, fillColor: '#2196f3', color: '#fff', weight: 1, fillOpacity: 0.8,
                        }).addTo(map);
                    });

                    // Fit bounds to show both incident and drone
                    map.fitBounds(L.latLngBounds([[lat, lng], [dLat, dLng], ...trackCoords]).pad(0.3));
                }
            }

            localMapInstance.current = map;
            return () => { map.remove(); localMapInstance.current = null; };
        }, []);

        // Swap tiles when mapMode or theme changes
        useEffect(() => {
            if (!localMapInstance.current || !tileRef.current) return;
            localMapInstance.current.removeLayer(tileRef.current);
            const url = mapMode === 'satellite' ? SATELLITE_TILES : streetTileUrl;
            tileRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(localMapInstance.current);
        }, [mapMode, themeMode]);

        return (
            <Box sx={{ position: 'relative' }}>
                <div ref={localMapRef} style={{ width: '100%', height: 400, borderRadius: 8, overflow: 'hidden' }} />
                <style>{`
                    @keyframes pulse-marker { 0%,100% { box-shadow: 0 0 8px ${severityColor}; } 50% { box-shadow: 0 0 25px ${severityColor}; } }
                `}</style>

                {/* Map Type Switcher */}
                <Box sx={{
                    position: 'absolute', top: 12, left: 56, zIndex: 1000,
                    display: 'flex', borderRadius: 1.5, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                    {[
                        { key: 'street', label: '🗺️ Map' },
                        { key: 'satellite', label: '🛰️ Satellite' },
                    ].map((opt) => (
                        <Box
                            key={opt.key}
                            onClick={() => setMapMode(opt.key)}
                            sx={{
                                px: 1.5, py: 0.6,
                                fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                                background: mapMode === opt.key ? 'rgba(33,150,243,0.9)' : 'rgba(0,0,0,0.7)',
                                color: '#fff',
                                transition: 'all 0.2s',
                                '&:hover': { background: mapMode === opt.key ? 'rgba(33,150,243,1)' : 'rgba(0,0,0,0.85)' },
                            }}
                        >
                            {opt.label}
                        </Box>
                    ))}
                </Box>

                {/* Drone info overlay */}
                {assignedDrone && (
                    <Paper sx={{
                        position: 'absolute', top: 12, right: 12, zIndex: 1000,
                        p: 1.5, borderRadius: 2, bgcolor: 'background.paper', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(33,150,243,0.3)', boxShadow: 3,
                    }}>
                        <Typography variant="caption" sx={{ color: '#2196f3', fontWeight: 700, display: 'block', mb: 0.5 }}>
                            🚁 {assignedDrone.name} ({assignedDrone.id})
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, fontSize: '0.7rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                <BatteryIcon sx={{ fontSize: 14, color: assignedDrone.battery > 50 ? '#4caf50' : '#ff9800' }} />
                                <Typography variant="caption">{assignedDrone.battery}%</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                <AltitudeIcon sx={{ fontSize: 14, color: '#90caf9' }} />
                                <Typography variant="caption">{assignedDrone.altitude}m</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                <SpeedIcon sx={{ fontSize: 14, color: '#ce93d8' }} />
                                <Typography variant="caption">{assignedDrone.speed} km/h</Typography>
                            </Box>
                        </Box>
                    </Paper>
                )}
                {!assignedDrone && (
                    <Paper sx={{
                        position: 'absolute', top: 12, right: 12, zIndex: 1000,
                        p: 1.5, borderRadius: 2, bgcolor: 'background.paper',
                        border: '1px solid', borderColor: 'divider', boxShadow: 3,
                    }}>
                        <Typography variant="caption" color="text.secondary">No drone assigned to this incident</Typography>
                    </Paper>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{ overflowY: 'auto', height: 'calc(100vh - 80px)', p: 2 }}>
            <style>{`
                @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.3; } }
            `}</style>

            {/* Top Bar: Incident Info */}
            <Paper sx={{ px: 3, py: 2, mb: 2, borderRadius: 2, borderLeft: `4px solid ${severityColor}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', background: severityColor, boxShadow: `0 0 10px ${severityColor}` }} />
                            <Typography variant="h5" fontWeight="bold">{incident.title || 'Unknown Incident'}</Typography>
                            <Chip label={incident.severity} size="small" sx={{ bgcolor: `${severityColor}22`, color: severityColor, fontWeight: 700, ml: 1 }} />
                            <Chip label={incident.status} size="small" color="primary" variant="outlined" />
                        </Box>
                        <Box sx={{ display: 'flex', gap: 3, mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">{incident.address || incident.location_name || 'Unknown'}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">{incident.created_at ? formatDistanceToNow(new Date(incident.created_at), { addSuffix: true }) : 'N/A'}</Typography>
                            </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{incident.description}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>📹 Video Source</Typography>
                        <ToggleButtonGroup value={videoSource} onChange={handleSourceChange} size="small"
                            sx={{ '& .MuiToggleButton-root': { color: 'text.secondary', borderColor: 'divider', px: 2.5, '&.Mui-selected': { color: '#fff', bgcolor: 'primary.main' } } }}>
                            <ToggleButton value="phone"><PhoneIcon sx={{ fontSize: 18, mr: 0.5 }} /> Phone</ToggleButton>
                            <ToggleButton value="drone"><DroneIcon sx={{ fontSize: 18, mr: 0.5 }} /> Drone</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>
            </Paper>

            {/* Video Area */}
            <Box sx={{ display: 'flex', gap: showBoth ? 2 : 0, minHeight: 300, maxHeight: 450, mb: 2, flexDirection: { xs: 'column', md: showBoth ? 'row' : 'column' } }}>
                {showPhone && <VideoPanel type="phone" label="📱 Phone Camera" refProp={phoneRef} />}
                {showDrone && <VideoPanel type="drone" label="🚁 Drone Camera" refProp={droneRef} />}
                {!showPhone && !showDrone && (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography color="text.secondary">Select a video source above</Typography>
                    </Box>
                )}
            </Box>

            {/* Tabs: Timeline | AI/ML Analysis | Live Map */}
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}
                    sx={{ borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' } }}>
                    <Tab icon={<TimelineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Timeline" />
                    <Tab icon={<AiIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="AI / ML Analysis" />
                    <Tab icon={<MapIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Live Map & Tracking" />
                </Tabs>

                {/* TIMELINE TAB */}
                {activeTab === 0 && (
                    <Box sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>📋 Incident Timeline</Typography>
                        <Box sx={{ position: 'relative', pl: 4 }}>
                            {/* Vertical line */}
                            <Box sx={{ position: 'absolute', left: 14, top: 0, bottom: 0, width: 2, bgcolor: 'divider' }} />
                            {timelineEvents.map((event, i) => (
                                <Box key={i} sx={{ mb: 3, position: 'relative' }}>
                                    {/* Dot */}
                                    <Box sx={{
                                        position: 'absolute', left: -26, top: 4, width: 22, height: 22, borderRadius: '50%',
                                        background: event.color + '22', border: `2px solid ${event.color}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, zIndex: 1,
                                    }}>
                                        {event.icon}
                                    </Box>
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="subtitle2" fontWeight="bold">{event.label}</Typography>
                                            <Chip label={event.time.toLocaleTimeString()} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">{event.detail}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* AI/ML ANALYSIS TAB */}
                {activeTab === 1 && (
                    <Box sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>🤖 AI / ML Analysis</Typography>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
                            {/* Face Matching */}
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <FaceIcon sx={{ color: '#e040fb' }} />
                                    <Typography variant="subtitle2" fontWeight="bold">Face Matching</Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                    Upload a reference photo to search for matching faces in the video stream.
                                </Typography>

                                {/* Upload area */}
                                <Box sx={{
                                    border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                                    cursor: 'pointer', '&:hover': { borderColor: '#e040fb', background: 'rgba(224,64,251,0.05)' },
                                }} component="label">
                                    {uploadedImage ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <img src={uploadedImage} alt="uploaded" style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover' }} />
                                            <Box>
                                                <Typography variant="caption" color="success.main">✅ Image uploaded</Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Click to change</Typography>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <>
                                            <UploadIcon sx={{ color: 'text.secondary' }} />
                                            <Typography variant="caption" color="text.secondary">Click to upload reference image</Typography>
                                        </>
                                    )}
                                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                                </Box>

                                <Button variant="contained" fullWidth size="small" onClick={() => runAnalysis('face')}
                                    disabled={analyzing} startIcon={<FaceIcon />}
                                    sx={{ bgcolor: '#e040fb', '&:hover': { bgcolor: '#ce35d8' } }}>
                                    {analyzing ? 'Scanning...' : 'Run Face Match'}
                                </Button>
                            </Paper>

                            {/* Video Analysis */}
                            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <AnalyticsIcon sx={{ color: '#00bcd4' }} />
                                    <Typography variant="subtitle2" fontWeight="bold">Video Scene Analysis</Typography>
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                    Analyze the live video feed for threat classification, object detection, and people count.
                                </Typography>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                                    {['Threat Classification', 'Object Detection', 'People Count', 'Area Analysis'].map(item => (
                                        <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CheckIcon sx={{ fontSize: 16, color: '#00bcd4' }} />
                                            <Typography variant="caption">{item}</Typography>
                                        </Box>
                                    ))}
                                </Box>

                                <Button variant="contained" fullWidth size="small" onClick={() => runAnalysis('scene')}
                                    disabled={analyzing} startIcon={<AnalyticsIcon />}
                                    sx={{ bgcolor: '#00bcd4', '&:hover': { bgcolor: '#0097a7' } }}>
                                    {analyzing ? 'Analyzing...' : 'Run Scene Analysis'}
                                </Button>
                            </Paper>
                        </Box>

                        {/* Analysis Progress */}
                        {analyzing && (
                            <Paper sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: 'action.hover' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                    🔄 AI model processing video frames...
                                </Typography>
                                <LinearProgress sx={{ borderRadius: 2 }} />
                            </Paper>
                        )}

                        {/* Analysis Results */}
                        {analysisResult && (
                            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid rgba(76,175,80,0.3)', background: 'rgba(76,175,80,0.05)' }}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5, color: '#4caf50' }}>
                                    ✅ {analysisResult.type} — Results
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                                    {analysisResult.results.map((r, i) => (
                                        <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, borderColor: 'divider' }}>
                                            <Typography variant="caption" color="text.secondary">{r.label}</Typography>
                                            <Typography variant="body2" fontWeight="bold">{r.value}</Typography>
                                            {r.confidence > 0 && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                    <LinearProgress variant="determinate" value={r.confidence} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: r.confidence > 80 ? '#4caf50' : r.confidence > 50 ? '#ff9800' : '#f44336' } }} />
                                                    <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>{r.confidence}%</Typography>
                                                </Box>
                                            )}
                                        </Paper>
                                    ))}
                                </Box>
                            </Paper>
                        )}
                    </Box>
                )}

                {/* LIVE MAP TAB */}
                {activeTab === 2 && (
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">📍 Live Location & Drone Tracking</Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: severityColor }} />
                                    <Typography variant="caption">Incident</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption">🚁</Typography>
                                    <Typography variant="caption">Drone</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ width: 12, height: 3, background: '#2196f3', borderRadius: 1 }} />
                                    <Typography variant="caption">Flight Path</Typography>
                                </Box>
                            </Box>
                        </Box>
                        <LiveMapPanel />
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default IncidentVideoPage;
