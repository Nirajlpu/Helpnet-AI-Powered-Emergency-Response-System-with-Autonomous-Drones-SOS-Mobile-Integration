import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchIncidents } from '@store/slices/incidentSlice.js';
import { incidentService } from '@services/incidentService.js';
import {
    Box, Typography, Chip, Paper, IconButton, Button, Tab, Tabs,
    ToggleButton, ToggleButtonGroup, LinearProgress, Divider,
    Select, MenuItem, FormControl, InputLabel, Alert, CircularProgress, TextField,
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
    Person as PersonIcon,
    Email as EmailIcon,
    Home as HomeIcon,
    Group as GroupIcon,
    Phone as PhoneCallIcon,
    OpenInNew as OpenInNewIcon,
    FiberManualRecord as RecordIcon,
    Stop as StopIcon,
    PlayArrow as PlayIcon,
    Videocam as VideocamIcon,
    Download as DownloadIcon,
    Gavel as GavelIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getSeverityColor = (severity) => ({
    'CRITICAL': '#ff4444',
    'HIGH': '#ff8800',
    'MEDIUM': '#ffcc00',
    'LOW': '#00cc00',
}[severity] || '#999');

// Timeline events — use real backend timeLine data if available, otherwise fall back to simulated
const getTimelineEvents = (incident) => {
    if (incident.timeLine && incident.timeLine.length > 0) {
        return incident.timeLine.map(e => ({
            time: new Date(e.time),
            label: e.label,
            detail: e.detail,
            icon: e.icon || '📋',
            color: e.color || '#ff9800',
        }));
    }
    // Fallback: simulated timeline from created_at
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
    const dispatch = useDispatch();
    const { items: incidents, isLoading, usingLiveData, error } = useSelector((state) => state.incidents || {});
    const { items: drones } = useSelector((state) => state.drones || {});
    const themeMode = useSelector((state) => state.ui.themeMode);
    const userProfile = useSelector((state) => state.auth.profile);
    const isCivilian = userProfile?.role === 'CIVILIAN';
    const incident = (incidents || []).find(inc => String(inc.id) === id);
    const assignedDrone = (drones || []).find(d => Number(d.assignedIncidentId) === Number(incident?.id));
    const reporterInfo = incident?.reporter_profile_detail || (typeof incident?.reporter === 'object' ? incident.reporter : null);
    const [videoSource, setVideoSource] = useState(['phone']);
    const [activeTab, setActiveTab] = useState(0);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState(null);
    const phoneRef = useRef(null);
    const droneRef = useRef(null);
    const [phoneFrameUrl, setPhoneFrameUrl] = useState(null);
    const frameIntervalRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef(null);
    const [recordingsList, setRecordingsList] = useState([]);
    const [playbackUrl, setPlaybackUrl] = useState(null);
    const [phoneLastRecUrl, setPhoneLastRecUrl] = useState(null); // in-panel playback when stream ends
    const phoneStreamAliveRef = useRef(false); // tracks if phone stream is currently active
    const phoneStaleCountRef = useRef(0);
    // Drone frame state
    const [droneFrameUrl, setDroneFrameUrl] = useState(null);
    const droneFrameIntervalRef = useRef(null);
    const [isDroneRecording, setIsDroneRecording] = useState(false);
    const [droneRecordingDuration, setDroneRecordingDuration] = useState(0);
    const droneRecordingTimerRef = useRef(null);
    const [droneRecordingsList, setDroneRecordingsList] = useState([]);
    const [dronePlaybackUrl, setDronePlaybackUrl] = useState(null);
    const [droneLastRecUrl, setDroneLastRecUrl] = useState(null);
    const droneStreamAliveRef = useRef(false);
    const droneStaleCountRef = useRef(0);
    // Authority action state
    const [actionStatus, setActionStatus] = useState(incident?.action_taken_by_authority || 'ACTIVE');
    const [actionRemark, setActionRemark] = useState('');
    const [actionSaving, setActionSaving] = useState(false);
    const [actionSuccess, setActionSuccess] = useState(null);
    useEffect(() => {
        if (incident?.action_taken_by_authority) setActionStatus(incident.action_taken_by_authority);
    }, [incident?.action_taken_by_authority]);
    const phonePollerRunningRef = useRef(false);
    const dronePollerRunningRef = useRef(false);
    const phoneStartPollerRef = useRef(null);
    const droneStartPollerRef = useRef(null);

    const severityColor = getSeverityColor(incident?.severity);

    useEffect(() => {
        if (!usingLiveData && !isLoading && !error) {
            dispatch(fetchIncidents());
        }
    }, [dispatch, usingLiveData, isLoading, error]);

    // Frame polling for phone stream — ZERO requests when offline, fast 200ms when live
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const apiBase = `http://${window.location.hostname}:8000`;
        const STALE_THRESHOLD = 15;
        const FAST_POLL_MS = 200;

        const pollPhone = async () => {
            if (cancelled || !phonePollerRunningRef.current) return;
            try {
                const res = await fetch(`${apiBase}/api/incidents/${id}/latest-frame/`);
                if (cancelled) return;
                if (res.ok) {
                    phoneStaleCountRef.current = 0;
                    phoneStreamAliveRef.current = true;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setPhoneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    setPhoneLastRecUrl(null);
                    if (!cancelled && phonePollerRunningRef.current)
                        frameIntervalRef.current = setTimeout(pollPhone, FAST_POLL_MS);
                } else {
                    phoneStaleCountRef.current += 1;
                    if (phoneStaleCountRef.current >= STALE_THRESHOLD) {
                        phoneStreamAliveRef.current = false;
                        phonePollerRunningRef.current = false;
                        setPhoneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
                        fetchRecordings();
                        return;
                    }
                    if (!cancelled && phonePollerRunningRef.current)
                        frameIntervalRef.current = setTimeout(pollPhone, FAST_POLL_MS);
                }
            } catch {
                if (cancelled) return;
                phoneStaleCountRef.current += 1;
                if (phoneStaleCountRef.current >= STALE_THRESHOLD) {
                    phoneStreamAliveRef.current = false;
                    phonePollerRunningRef.current = false;
                    setPhoneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
                    fetchRecordings();
                    return;
                }
                if (!cancelled && phonePollerRunningRef.current)
                    frameIntervalRef.current = setTimeout(pollPhone, FAST_POLL_MS);
            }
        };

        // One-shot probe on mount — only start fast polling if stream is already live
        (async () => {
            try {
                const res = await fetch(`${apiBase}/api/incidents/${id}/latest-frame/`);
                if (cancelled || phonePollerRunningRef.current) return;
                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setPhoneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    phoneStreamAliveRef.current = true;
                    phonePollerRunningRef.current = true;
                    setPhoneLastRecUrl(null);
                    frameIntervalRef.current = setTimeout(pollPhone, FAST_POLL_MS);
                }
            } catch { /* offline */ }
        })();

        // Expose async start: probes first, only starts fast-poll on 200
        phoneStartPollerRef.current = async () => {
            if (phonePollerRunningRef.current || cancelled) return;
            try {
                const res = await fetch(`${apiBase}/api/incidents/${id}/latest-frame/`);
                if (cancelled || phonePollerRunningRef.current) return;
                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setPhoneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    phoneStreamAliveRef.current = true;
                    phonePollerRunningRef.current = true;
                    phoneStaleCountRef.current = 0;
                    setPhoneLastRecUrl(null);
                    frameIntervalRef.current = setTimeout(pollPhone, FAST_POLL_MS);
                }
                // 204 → stream not actually live, don't start polling
            } catch { /* offline */ }
        };

        return () => {
            cancelled = true;
            phonePollerRunningRef.current = false;
            if (frameIntervalRef.current) clearTimeout(frameIntervalRef.current);
            setPhoneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        };
    }, [id]);

    // Frame polling for drone stream — ZERO requests when offline, fast 200ms when live
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const apiBase = `http://${window.location.hostname}:8000`;
        const STALE_THRESHOLD = 15;
        const FAST_POLL_MS = 200;

        const pollDrone = async () => {
            if (cancelled || !dronePollerRunningRef.current) return;
            try {
                const res = await fetch(`${apiBase}/api/incidents/${id}/drone-latest-frame/`);
                if (cancelled) return;
                if (res.ok) {
                    droneStaleCountRef.current = 0;
                    droneStreamAliveRef.current = true;
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setDroneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    setDroneLastRecUrl(null);
                    if (!cancelled && dronePollerRunningRef.current)
                        droneFrameIntervalRef.current = setTimeout(pollDrone, FAST_POLL_MS);
                } else {
                    droneStaleCountRef.current += 1;
                    if (droneStaleCountRef.current >= STALE_THRESHOLD) {
                        droneStreamAliveRef.current = false;
                        dronePollerRunningRef.current = false;
                        setDroneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
                        fetchDroneRecordings();
                        return;
                    }
                    if (!cancelled && dronePollerRunningRef.current)
                        droneFrameIntervalRef.current = setTimeout(pollDrone, FAST_POLL_MS);
                }
            } catch {
                if (cancelled) return;
                droneStaleCountRef.current += 1;
                if (droneStaleCountRef.current >= STALE_THRESHOLD) {
                    droneStreamAliveRef.current = false;
                    dronePollerRunningRef.current = false;
                    setDroneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
                    fetchDroneRecordings();
                    return;
                }
                if (!cancelled && dronePollerRunningRef.current)
                    droneFrameIntervalRef.current = setTimeout(pollDrone, FAST_POLL_MS);
            }
        };

        // One-shot probe on mount
        (async () => {
            try {
                const res = await fetch(`${apiBase}/api/incidents/${id}/drone-latest-frame/`);
                if (cancelled || dronePollerRunningRef.current) return;
                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setDroneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    droneStreamAliveRef.current = true;
                    dronePollerRunningRef.current = true;
                    setDroneLastRecUrl(null);
                    droneFrameIntervalRef.current = setTimeout(pollDrone, FAST_POLL_MS);
                }
            } catch { /* offline */ }
        })();

        // Expose async start: probes first, only starts fast-poll on 200
        droneStartPollerRef.current = async () => {
            if (dronePollerRunningRef.current || cancelled) return;
            try {
                const res = await fetch(`${apiBase}/api/incidents/${id}/drone-latest-frame/`);
                if (cancelled || dronePollerRunningRef.current) return;
                if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    setDroneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    droneStreamAliveRef.current = true;
                    dronePollerRunningRef.current = true;
                    droneStaleCountRef.current = 0;
                    setDroneLastRecUrl(null);
                    droneFrameIntervalRef.current = setTimeout(pollDrone, FAST_POLL_MS);
                }
            } catch { /* offline */ }
        };

        return () => {
            cancelled = true;
            dronePollerRunningRef.current = false;
            if (droneFrameIntervalRef.current) clearTimeout(droneFrameIntervalRef.current);
            setDroneFrameUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
        };
    }, [id]);

    // Recording-status heartbeat — lightweight JSON check every 10s
    // Also wakes up frame pollers when a new stream is detected
    const wasPhoneRecRef = useRef(false);
    const wasDroneRecRef = useRef(false);
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        const apiBase = `http://${window.location.hostname}:8000`;
        const checkStatus = async () => {
            try {
                const [phoneRes, droneRes] = await Promise.all([
                    fetch(`${apiBase}/api/incidents/${id}/recording-status/`).then(r => r.json()),
                    fetch(`${apiBase}/api/incidents/${id}/drone-recording-status/`).then(r => r.json()),
                ]);
                if (cancelled) return;
                if (phoneRes.recording) {
                    setIsRecording(true);
                    setRecordingDuration(Math.floor(phoneRes.duration_seconds || 0));
                    // Only wake poller on transition (false→true), not every 10s
                    if (!wasPhoneRecRef.current) {
                        wasPhoneRecRef.current = true;
                        if (phoneStartPollerRef.current) phoneStartPollerRef.current();
                    }
                } else {
                    if (wasPhoneRecRef.current) {
                        wasPhoneRecRef.current = false;
                        setIsRecording(false);
                        setRecordingDuration(0);
                        fetchRecordings();
                    }
                }
                if (droneRes.recording) {
                    setIsDroneRecording(true);
                    setDroneRecordingDuration(Math.floor(droneRes.duration_seconds || 0));
                    if (!wasDroneRecRef.current) {
                        wasDroneRecRef.current = true;
                        if (droneStartPollerRef.current) droneStartPollerRef.current();
                    }
                } else {
                    if (wasDroneRecRef.current) {
                        wasDroneRecRef.current = false;
                        setIsDroneRecording(false);
                        setDroneRecordingDuration(0);
                        fetchDroneRecordings();
                    }
                }
            } catch (e) { /* ignore */ }
        };
        checkStatus();
        const statusInterval = setInterval(checkStatus, 10000);
        return () => { cancelled = true; clearInterval(statusInterval); };
    }, [id]);

    // Recording duration timer
    useEffect(() => {
        if (isRecording) {
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        }
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        };
    }, [isRecording]);

    // Drone recording duration timer
    useEffect(() => {
        if (isDroneRecording) {
            droneRecordingTimerRef.current = setInterval(() => {
                setDroneRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (droneRecordingTimerRef.current) clearInterval(droneRecordingTimerRef.current);
        }
        return () => {
            if (droneRecordingTimerRef.current) clearInterval(droneRecordingTimerRef.current);
        };
    }, [isDroneRecording]);

    const apiBase = `http://${window.location.hostname}:8000`;

    const startRecording = async () => {
        try {
            const res = await fetch(`${apiBase}/api/incidents/${id}/start-recording/`, { method: 'POST' });
            if (res.ok) {
                setIsRecording(true);
                setRecordingDuration(0);
            }
        } catch (e) { console.error('Failed to start recording', e); }
    };

    const stopRecording = async () => {
        try {
            const res = await fetch(`${apiBase}/api/incidents/${id}/stop-recording/`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setIsRecording(false);
                setRecordingDuration(0);
                fetchRecordings();
                if (data.video_url) {
                    const fullUrl = `${apiBase}${data.video_url}`;
                    setPlaybackUrl(fullUrl);
                    setPhoneLastRecUrl(fullUrl);
                }
            }
        } catch (e) { console.error('Failed to stop recording', e); }
    };

    const fetchRecordings = async () => {
        try {
            const res = await fetch(`${apiBase}/api/incidents/${id}/recordings/`);
            if (res.ok) {
                const data = await res.json();
                setRecordingsList(data);
                // Set last recording for in-panel playback (if no live stream)
                if (data.length > 0 && !phoneStreamAliveRef.current) {
                    setPhoneLastRecUrl(`${apiBase}${data[0].url}`);
                }
            }
        } catch (e) { /* ignore */ }
    };

    const startDroneRecording = async () => {
        try {
            const res = await fetch(`${apiBase}/api/incidents/${id}/drone-start-recording/`, { method: 'POST' });
            if (res.ok) {
                setIsDroneRecording(true);
                setDroneRecordingDuration(0);
            }
        } catch (e) { console.error('Failed to start drone recording', e); }
    };

    const stopDroneRecording = async () => {
        try {
            const res = await fetch(`${apiBase}/api/incidents/${id}/drone-stop-recording/`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setIsDroneRecording(false);
                setDroneRecordingDuration(0);
                fetchDroneRecordings();
                if (data.video_url) {
                    const fullUrl = `${apiBase}${data.video_url}`;
                    setDronePlaybackUrl(fullUrl);
                    setDroneLastRecUrl(fullUrl);
                }
            }
        } catch (e) { console.error('Failed to stop drone recording', e); }
    };

    const fetchDroneRecordings = async () => {
        try {
            const res = await fetch(`${apiBase}/api/incidents/${id}/drone-recordings/`);
            if (res.ok) {
                const data = await res.json();
                setDroneRecordingsList(data);
                if (data.length > 0 && !droneStreamAliveRef.current) {
                    setDroneLastRecUrl(`${apiBase}${data[0].url}`);
                }
            }
        } catch (e) { /* ignore */ }
    };

    // Load recordings on mount
    useEffect(() => {
        if (id) {
            fetchRecordings();
            fetchDroneRecordings();
        }
    }, [id]);

    // Live Map — useMemo keeps a stable component identity so the map doesn't
    // remount every time parent state (frameUrl, isRecording…) changes.
    const LiveMapPanel = useMemo(() => {
        const Panel = () => {
            const localMapRef = useRef(null);
            const localMapInstance = useRef(null);
            const tileRef = useRef(null);
            const [mapMode, setMapMode] = useState('street');

            const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            const streetTileUrl = themeMode === 'dark'
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

            useEffect(() => {
                if (!localMapRef.current || localMapInstance.current) return;

                const coords = incident?.location_coordinates?.coordinates || incident?.location?.coordinates;
                const [lng, lat] = coords || [78.9629, 20.5937];
                const map = L.map(localMapRef.current, { center: [lat, lng], zoom: 14, zoomControl: true, attributionControl: false });
                tileRef.current = L.tileLayer(streetTileUrl, { maxZoom: 19 }).addTo(map);

                const incidentIcon = L.divIcon({
                    html: `<div style="width:20px;height:20px;background:${severityColor};border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px ${severityColor};animation:pulse-marker 2s infinite"></div>`,
                    className: '', iconSize: [20, 20], iconAnchor: [10, 10],
                });
                L.marker([lat, lng], { icon: incidentIcon }).addTo(map)
                    .bindPopup(`<b style="color:${severityColor}">${incident?.title || ''}</b><br/>${incident?.address || ''}`);

                if (assignedDrone && assignedDrone.location?.coordinates) {
                    const [dLng, dLat] = assignedDrone.location.coordinates;
                    const droneIcon = L.divIcon({
                        html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:20px;filter:drop-shadow(0 0 6px #2196f3)">🚁</div>`,
                        className: '', iconSize: [28, 28], iconAnchor: [14, 14],
                    });
                    L.marker([dLat, dLng], { icon: droneIcon }).addTo(map)
                        .bindPopup(`<b>🚁 ${assignedDrone.name}</b><br/>Battery: ${assignedDrone.battery}%<br/>Altitude: ${assignedDrone.altitude}m`);

                    if (assignedDrone.track && assignedDrone.track.length > 0) {
                        const trackCoords = assignedDrone.track.map(([tLng, tLat]) => [tLat, tLng]);
                        L.polyline(trackCoords, { color: '#2196f3', weight: 3, opacity: 0.7, dashArray: '8, 4' }).addTo(map);
                        trackCoords.forEach((coord) => {
                            L.circleMarker(coord, { radius: 4, fillColor: '#2196f3', color: '#fff', weight: 1, fillOpacity: 0.8 }).addTo(map);
                        });
                        map.fitBounds(L.latLngBounds([[lat, lng], [dLat, dLng], ...trackCoords]).pad(0.3));
                    }
                }

                localMapInstance.current = map;
                return () => { map.remove(); localMapInstance.current = null; };
            }, []);

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
        return Panel;
    }, [incident?.id, themeMode, assignedDrone?.id, severityColor]);

    if (!usingLiveData && !error) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Box sx={{ width: '50%', textAlign: 'center' }}>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>Loading incident data...</Typography>
                    <LinearProgress />
                </Box>
            </Box>
        );
    }

    if (!incident) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
                <Typography variant="h5" color="text.secondary">Incident not found</Typography>
            </Box>
        );
    }

    const formatDuration = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

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

    const renderVideoPanel = (type, label, refProp) => {
        const frameUrl = type === 'phone' ? phoneFrameUrl : droneFrameUrl;
        const recording = type === 'phone' ? isRecording : isDroneRecording;
        const recDuration = type === 'phone' ? recordingDuration : droneRecordingDuration;
        const onStartRec = type === 'phone' ? startRecording : startDroneRecording;
        const onStopRec = type === 'phone' ? stopRecording : stopDroneRecording;
        const lastRecUrl = type === 'phone' ? phoneLastRecUrl : droneLastRecUrl;
        const isLive = !!frameUrl;
        const hasPlayback = !isLive && !!lastRecUrl;

        return (
            <Paper ref={refProp} sx={{
                flex: 1, background: '#0a0a0a', borderRadius: 2, display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden', border: '1px solid', borderColor: 'divider', minHeight: 0,
            }}>
                {/* Header bar */}
                <Box sx={{ position: 'relative', zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1, bgcolor: 'rgba(18,18,18,0.85)', backdropFilter: 'blur(6px)', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isLive ? '#ff4444' : hasPlayback ? '#ff9800' : '#666',
                            animation: isLive ? 'blink 1.5s infinite' : 'none'
                        }} />
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }}>
                            {label} — {isLive ? 'LIVE' : hasPlayback ? 'PLAYBACK' : 'OFFLINE'}
                        </Typography>
                        {recording && (
                            <Chip
                                icon={<RecordIcon sx={{ fontSize: 12, color: '#ff4444 !important', animation: 'blink 1s infinite' }} />}
                                label={`REC ${formatDuration(recDuration)}`}
                                size="small"
                                sx={{ height: 22, fontSize: '0.7rem', bgcolor: 'rgba(255,68,68,0.15)', color: '#ff4444', fontWeight: 700, fontFamily: 'monospace' }}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {/* Manual record/stop — visible when live */}
                        {isLive && (
                            recording ? (
                                <IconButton size="small" onClick={onStopRec} sx={{ color: '#ff4444' }} title="Stop Recording">
                                    <StopIcon fontSize="small" />
                                </IconButton>
                            ) : (
                                <IconButton size="small" onClick={onStartRec} sx={{ color: '#ccc', '&:hover': { color: '#ff4444' } }} title="Start Recording">
                                    <RecordIcon fontSize="small" />
                                </IconButton>
                            )
                        )}
                        <IconButton size="small" onClick={() => toggleFullscreen(refProp)} sx={{ color: '#fff' }}><FullscreenIcon /></IconButton>
                    </Box>
                </Box>

                {/* Main video / playback area */}
                <Box sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 250,
                    position: 'relative', overflow: 'hidden',
                    background: type === 'phone' ? 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)' : 'radial-gradient(ellipse at center, #0d1b0d 0%, #0a0a0a 70%)',
                }}>
                    {isLive ? (
                        /* Live stream frame */
                        <img
                            src={frameUrl}
                            alt={`Live ${type} feed`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
                        />
                    ) : hasPlayback ? (
                        /* Stream ended — show last recorded video */
                        <video
                            key={lastRecUrl}
                            controls
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0, background: '#000' }}
                        >
                            <source src={lastRecUrl} type="video/mp4" />
                        </video>
                    ) : (
                        /* No stream, no recording yet */
                        <>
                            {type === 'phone' ? <PhoneIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 1 }} /> : <DroneIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 1 }} />}
                            <Typography variant="body2" color="text.secondary">{type === 'phone' ? '📱 Phone Stream' : '🚁 Drone Stream'}</Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>Waiting for live feed connection...</Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.3, fontStyle: 'italic' }}>Recording starts automatically when stream begins</Typography>
                        </>
                    )}
                    {!hasPlayback && (
                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)' }} />
                    )}
                </Box>

                {/* Footer bar */}
                <Box sx={{ position: 'relative', zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 0.8, bgcolor: 'rgba(18,18,18,0.85)', backdropFilter: 'blur(6px)', borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#aaa' }}>
                        {type === 'phone' ? 'CAM:PHONE-01' : 'CAM:DRONE-01'}
                        {recording ? ' • AUTO-REC' : ''}
                    </Typography>
                    <Chip
                        label={isLive ? 'LIVE' : hasPlayback ? '▶ REC' : 'OFFLINE'}
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', bgcolor: isLive ? '#ff4444' : hasPlayback ? '#ff9800' : '#666', color: '#fff' }}
                    />
                </Box>
            </Paper>
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
                                <Typography variant="body2" color="text.secondary">{incident.created_at ? format(new Date(incident.created_at), 'MMM d, yyyy, h:mm a') : 'N/A'}</Typography>
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
                {showPhone && renderVideoPanel('phone', '📱 Phone Camera', phoneRef)}
                {showDrone && renderVideoPanel('drone', '🚁 Drone Camera', droneRef)}
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
                    <Tab icon={<PersonIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Reporter" />
                    <Tab icon={<TimelineIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Timeline" />
                    <Tab icon={<AiIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="AI / ML Analysis" />
                    <Tab icon={<MapIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Live Map & Tracking" />
                    <Tab icon={<VideocamIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Recordings${recordingsList.length ? ` (${recordingsList.length})` : ''}`} />
                </Tabs>

                {/* REPORTER TAB */}
                {activeTab === 0 && (
                    <Box sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>👤 Reporter Details</Typography>
                        {reporterInfo ? (
                            <Box>
                                {/* Reporter profile card */}
                                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
                                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                        {/* Avatar */}
                                        <Box sx={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '3px solid', borderColor: 'primary.main', flexShrink: 0 }}>
                                            <img src={reporterInfo.avatar} alt={reporterInfo.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.src = 'https://i.pravatar.cc/150?img=0'; }}
                                            />
                                        </Box>
                                        {/* Info */}
                                        <Box sx={{ flex: 1, minWidth: 200 }}>
                                            <Typography variant="h6" fontWeight="bold">{reporterInfo.name}</Typography>
                                            <Chip label={reporterInfo.role} size="small" color="primary" variant="outlined" sx={{ mt: 0.5, mb: 1.5 }} />

                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <PhoneCallIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                    <Typography variant="body2">{reporterInfo.phone || 'N/A'}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                                                    <Typography variant="body2">{reporterInfo.email || 'N/A'}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, gridColumn: '1 / -1' }}>
                                                    <HomeIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.3 }} />
                                                    <Typography variant="body2">
                                                        {[reporterInfo.village_city, reporterInfo.district, reporterInfo.state, reporterInfo.pincode].filter(Boolean).join(', ') || 'N/A'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Paper>

                                {/* Current Location from Incident */}
                                {(() => {
                                    const incCoords = incident?.location_coordinates?.coordinates;
                                    const rCoords = incCoords || reporterInfo.location_coordinates?.coordinates || [reporterInfo.location?.lng, reporterInfo.location?.lat];
                                    if (!rCoords || rCoords.includes(undefined)) return null;
                                    return (
                                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <LocationIcon sx={{ fontSize: 20, color: '#e53935' }} />
                                                <Typography variant="subtitle2" fontWeight="bold">Current Location (at time of incident)</Typography>
                                            </Box>
                                            {incident?.address && (
                                                <Typography variant="body2" sx={{ mb: 1 }}>
                                                    📍 {incident.address}
                                                </Typography>
                                            )}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                                <Typography variant="body2" color="text.secondary">
                                                    Lat: {rCoords[1]?.toFixed(4)}, Lng: {rCoords[0]?.toFixed(4)}
                                                </Typography>
                                                <Button
                                                    variant="outlined" size="small" startIcon={<OpenInNewIcon />}
                                                    href={`https://www.google.com/maps?q=${rCoords[1]},${rCoords[0]}`}
                                                    target="_blank" rel="noopener"
                                                    sx={{ textTransform: 'none', fontSize: '0.8rem' }}
                                                >
                                                    Open in Google Maps
                                                </Button>
                                            </Box>
                                        </Paper>
                                    );
                                })()}

                                {/* Family Members */}
                                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                        <GroupIcon sx={{ fontSize: 20, color: '#1976d2' }} />
                                        <Typography variant="subtitle2" fontWeight="bold">
                                            Family Members {reporterInfo.family_members?.length > 0 && `(${reporterInfo.family_members.length})`}
                                        </Typography>
                                    </Box>
                                    {reporterInfo.family_members?.length > 0 ? (
                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                                            {reporterInfo.family_members.map((member, i) => (
                                                <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Box sx={{
                                                        width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0
                                                    }}>
                                                        {member.name.charAt(0)}
                                                    </Box>
                                                    <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography variant="body2" fontWeight={600} noWrap>{member.name}</Typography>
                                                            <Chip label={member.relation || member.role} size="small" variant="outlined" color="primary" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                        </Box>
                                                        {member.user_id_code && (
                                                            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500, fontSize: '0.7rem', letterSpacing: 0.3 }}>
                                                                {member.user_id_code}
                                                            </Typography>
                                                        )}
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            📞 {member.phone || member.to_user_phone || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Paper>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">No family members registered.</Typography>
                                    )}
                                </Paper>
                            </Box>
                        ) : (
                            <Typography variant="body2" color="text.secondary">Reporter details not available.</Typography>
                        )}
                    </Box>
                )}

                {/* AUTHORITY ACTION TAB */}
                {activeTab === 0 && isCivilian && (
                    <Box sx={{ px: 3, pb: 3 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Authority actions are only available to authorized personnel (Police Station, District, State, Central operators and Admins).
                        </Alert>
                    </Box>
                )}
                {activeTab === 0 && !isCivilian && (
                    <Box sx={{ px: 3, pb: 3 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <GavelIcon sx={{ fontSize: 20 }} /> Authority Action
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 200 }}>
                                    <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>Status:</Typography>
                                    <Chip
                                        label={incident?.status || 'N/A'}
                                        size="small"
                                        color={incident?.status === 'RESOLVED' ? 'success' : 'warning'}
                                        variant="filled"
                                    />
                                </Box>
                                {incident?.authority_detail && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Handled by:</Typography>
                                        <Chip label={incident.authority_detail.name} size="small" variant="outlined" />
                                    </Box>
                                )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mt: 2.5, flexWrap: 'wrap' }}>
                                <FormControl size="small" sx={{ minWidth: 220 }}>
                                    <InputLabel>Action Taken</InputLabel>
                                    <Select
                                        value={actionStatus}
                                        label="Action Taken"
                                        onChange={(e) => { setActionStatus(e.target.value); setActionSuccess(null); }}
                                        disabled={incident?.status === 'RESOLVED'}
                                    >
                                        <MenuItem value="ACTIVE">Active</MenuItem>
                                        <MenuItem value="UNDER_REVIEW">Under Review</MenuItem>
                                        <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                                        <MenuItem value="COMPLETED">Completed (Auto-Resolves)</MenuItem>
                                        <MenuItem value="FALSE_ALARM">False Alarm</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={4}
                                size="small"
                                label="Remark"
                                placeholder="Add your remark / observation about this action..."
                                value={actionRemark}
                                onChange={(e) => setActionRemark(e.target.value)}
                                disabled={incident?.status === 'RESOLVED'}
                                sx={{ mt: 2 }}
                            />

                            <Box sx={{ mt: 2 }}>
                                <Button
                                    variant="contained"
                                    size="small"
                                    disabled={actionSaving || incident?.status === 'RESOLVED' || (actionStatus === incident?.action_taken_by_authority && !actionRemark.trim())}
                                    startIcon={actionSaving ? <CircularProgress size={16} /> : <GavelIcon />}
                                    onClick={async () => {
                                        setActionSaving(true);
                                        setActionSuccess(null);
                                        try {
                                            await incidentService.update(incident.id, {
                                                action_taken_by_authority: actionStatus,
                                                authority_remark: actionRemark.trim(),
                                            });
                                            dispatch(fetchIncidents());
                                            setActionSuccess('Action updated successfully' + (actionStatus === 'COMPLETED' ? ' — incident resolved.' : '.'));
                                            setActionRemark('');
                                        } catch (err) {
                                            setActionSuccess('Failed to update: ' + (err.response?.data?.detail || err.message));
                                        } finally {
                                            setActionSaving(false);
                                        }
                                    }}
                                    sx={{ textTransform: 'none', fontWeight: 600 }}
                                >
                                    Update Action
                                </Button>
                            </Box>

                            {actionSuccess && (
                                <Alert severity={actionSuccess.startsWith('Failed') ? 'error' : 'success'} sx={{ mt: 2 }}>
                                    {actionSuccess}
                                </Alert>
                            )}

                            {incident?.status === 'RESOLVED' && (
                                <Alert severity="info" sx={{ mt: 2 }}>
                                    This incident has been resolved{incident.resolved_at ? ` on ${format(new Date(incident.resolved_at), 'MMM d, yyyy, h:mm a')}` : ''}.
                                </Alert>
                            )}
                        </Paper>
                    </Box>
                )}

                {/* TIMELINE TAB */}
                {activeTab === 1 && (
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
                                            <Chip label={format(event.time, 'MMM d, yyyy, h:mm:ss a')} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">{event.detail}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* AI/ML ANALYSIS TAB */}
                {activeTab === 2 && (
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
                {activeTab === 3 && (
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

                {/* RECORDINGS / PLAYBACK TAB */}
                {activeTab === 4 && (
                    <Box sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">🎬 Recordings & Playback</Typography>
                            <Button variant="outlined" size="small" onClick={() => { fetchRecordings(); fetchDroneRecordings(); }} sx={{ textTransform: 'none' }}>
                                Refresh
                            </Button>
                        </Box>

                        {/* Video Player (phone or drone) */}
                        {(playbackUrl || dronePlaybackUrl) && (
                            <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                                <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <PlayIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                                    <Typography variant="body2" fontWeight={600}>Now Playing</Typography>
                                </Box>
                                <Box sx={{ background: '#000', display: 'flex', justifyContent: 'center' }}>
                                    <video
                                        key={playbackUrl || dronePlaybackUrl}
                                        controls
                                        autoPlay
                                        playsInline
                                        style={{ width: '100%', maxHeight: 450 }}
                                    >
                                        <source src={playbackUrl || dronePlaybackUrl} type="video/mp4" />
                                    </video>
                                </Box>
                            </Paper>
                        )}

                        {/* Active Recording Status Cards */}
                        {isRecording && (
                            <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(255,68,68,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <RecordIcon sx={{ color: '#ff4444', animation: 'blink 1s infinite' }} />
                                    <Box>
                                        <Typography variant="body2" fontWeight={600} sx={{ color: '#ff4444' }}>📱 Phone Recording in Progress</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                            Duration: {formatDuration(recordingDuration)}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button variant="contained" size="small" color="error" startIcon={<StopIcon />} onClick={stopRecording}
                                    sx={{ textTransform: 'none' }}>
                                    Stop & Save
                                </Button>
                            </Paper>
                        )}
                        {isDroneRecording && (
                            <Paper sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid rgba(33,150,243,0.3)', background: 'rgba(33,150,243,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <RecordIcon sx={{ color: '#2196f3', animation: 'blink 1s infinite' }} />
                                    <Box>
                                        <Typography variant="body2" fontWeight={600} sx={{ color: '#2196f3' }}>🚁 Drone Recording in Progress</Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                            Duration: {formatDuration(droneRecordingDuration)}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button variant="contained" size="small" startIcon={<StopIcon />} onClick={stopDroneRecording}
                                    sx={{ textTransform: 'none', bgcolor: '#2196f3' }}>
                                    Stop & Save
                                </Button>
                            </Paper>
                        )}

                        {/* Phone Recordings */}
                        <Typography variant="subtitle2" sx={{ mb: 1, mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>📱 Phone Recordings</Typography>
                        {recordingsList.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
                                {recordingsList.map((rec, i) => (
                                    <Paper key={`phone-${i}`} variant="outlined" sx={{
                                        p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                                        ...(playbackUrl?.includes(rec.filename) ? { borderColor: 'primary.main', bgcolor: 'rgba(33,150,243,0.08)' } : {})
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={() => { setPlaybackUrl(`${apiBase}${rec.url}`); setDronePlaybackUrl(null); }}>
                                            <VideocamIcon sx={{ color: 'primary.main' }} />
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>{rec.filename}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {rec.size_bytes ? `${(rec.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button size="small" startIcon={<PlayIcon />} onClick={() => { setPlaybackUrl(`${apiBase}${rec.url}`); setDronePlaybackUrl(null); }}
                                                sx={{ textTransform: 'none' }}>
                                                Play
                                            </Button>
                                            <IconButton size="small" component="a" href={`${apiBase}${rec.url}`} download
                                                sx={{ color: 'text.secondary' }} title="Download">
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        ) : !isRecording ? (
                            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
                                <Typography variant="body2" color="text.secondary">No phone recordings yet</Typography>
                            </Paper>
                        ) : null}

                        {/* Drone Recordings */}
                        <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>🚁 Drone Recordings</Typography>
                        {droneRecordingsList.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {droneRecordingsList.map((rec, i) => (
                                    <Paper key={`drone-${i}`} variant="outlined" sx={{
                                        p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer', '&:hover': { borderColor: '#2196f3', bgcolor: 'action.hover' },
                                        ...(dronePlaybackUrl?.includes(rec.filename) ? { borderColor: '#2196f3', bgcolor: 'rgba(33,150,243,0.08)' } : {})
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={() => { setDronePlaybackUrl(`${apiBase}${rec.url}`); setPlaybackUrl(null); }}>
                                            <DroneIcon sx={{ color: '#2196f3' }} />
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>{rec.filename}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {rec.size_bytes ? `${(rec.size_bytes / 1024 / 1024).toFixed(2)} MB` : 'Unknown size'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button size="small" startIcon={<PlayIcon />} onClick={() => { setDronePlaybackUrl(`${apiBase}${rec.url}`); setPlaybackUrl(null); }}
                                                sx={{ textTransform: 'none' }}>
                                                Play
                                            </Button>
                                            <IconButton size="small" component="a" href={`${apiBase}${rec.url}`} download
                                                sx={{ color: 'text.secondary' }} title="Download">
                                                <DownloadIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        ) : !isDroneRecording ? (
                            <Paper sx={{ p: 3, borderRadius: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider' }}>
                                <Typography variant="body2" color="text.secondary">No drone recordings yet</Typography>
                            </Paper>
                        ) : null}
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default IncidentVideoPage;
