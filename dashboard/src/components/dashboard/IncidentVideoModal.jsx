import React, { useState, useRef, useEffect } from 'react';
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
import { format } from 'date-fns';

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
    const [phoneStream, setPhoneStream] = useState(null);
    const [frameUrl, setFrameUrl] = useState(null);
    const frameIntervalRef = useRef(null);
    const audioCtxRef = useRef(null);
    const audioNextTimeRef = useRef(0);

    // Frame polling fallback for phone stream
    useEffect(() => {
        if (!open || !incident) return;

        let cancelled = false;
        let webrtcConnected = false;

        // --- WebRTC attempt ---
        console.log("Setting up WebRTC connection for incident", incident.id);
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.ontrack = (event) => {
            console.log("Received remote track:", event.streams[0]);
            webrtcConnected = true;
            setPhoneStream(event.streams[0]);
        };

        let ws = null;
        try {
            const wsUrl = `ws://${window.location.hostname}:8000/ws/video/${incident.id}/`;
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log("Connected to video signaling server");
                ws.send(JSON.stringify({ type: 'request-offer' }));
            };

            ws.onmessage = async (e) => {
                try {
                    const message = JSON.parse(e.data);
                    if (message.type === 'offer') {
                        console.log("Received WebRTC offer");
                        await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        ws.send(JSON.stringify({ type: 'answer', answer }));
                        console.log("Sent WebRTC answer");
                    } else if (message.type === 'icecandidate') {
                        console.log("Received ICE candidate");
                        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
                    }
                } catch (err) {
                    console.error("Error processing signaling message:", err);
                }
            };

            ws.onerror = (err) => {
                console.warn("WebSocket error, falling back to frame polling", err);
            };
        } catch (err) {
            console.warn("WebSocket connection failed:", err);
        }

        pc.onicecandidate = (event) => {
            if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'icecandidate', candidate: event.candidate }));
            }
        };

        // --- Frame polling fallback ---
        // Start polling after a short delay to give WebRTC a chance
        const fallbackTimer = setTimeout(() => {
            if (cancelled || webrtcConnected) return;
            console.log("Starting frame polling fallback for incident", incident.id);
            const apiBase = `http://${window.location.hostname}:8000`;
            frameIntervalRef.current = setInterval(async () => {
                if (webrtcConnected) {
                    clearInterval(frameIntervalRef.current);
                    return;
                }
                try {
                    const res = await fetch(`${apiBase}/api/incidents/${incident.id}/latest-frame/`);
                    if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        setFrameUrl(prev => {
                            if (prev) URL.revokeObjectURL(prev);
                            return url;
                        });
                    }
                } catch (e) {
                    // ignore fetch errors silently
                }
            }, 200); // ~5 fps polling
        }, 3000);

        return () => {
            cancelled = true;
            clearTimeout(fallbackTimer);
            if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
            pc.close();
            if (ws) ws.close();
            setPhoneStream(null);
            setFrameUrl(prev => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
        };
    }, [open, incident]);

    // --- Real-time audio playback via WebSocket ---
    useEffect(() => {
        if (!open || !incident) return;

        const SAMPLE_RATE = 16000; // must match Android AudioRecord config
        let audioCtx = null;
        let audioWs = null;

        try {
            const wsUrl = `ws://${window.location.hostname}:8000/ws/audio/${incident.id}/`;
            audioWs = new WebSocket(wsUrl);

            audioWs.onopen = () => {
                console.log("[audio] Connected to audio stream for incident", incident.id);
                audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
                audioCtxRef.current = audioCtx;
                audioNextTimeRef.current = 0;
            };

            audioWs.onmessage = (e) => {
                if (!audioCtx || audioCtx.state === 'closed') return;

                // Resume context if suspended (browser autoplay policy)
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type !== 'audio' || !msg.data) return;

                    // Decode base64 → Int16 PCM → Float32 for Web Audio
                    const raw = atob(msg.data);
                    const bytes = new Uint8Array(raw.length);
                    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
                    const int16 = new Int16Array(bytes.buffer);
                    const float32 = new Float32Array(int16.length);
                    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

                    // Schedule playback buffer
                    const buffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
                    buffer.getChannelData(0).set(float32);
                    const source = audioCtx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(audioCtx.destination);

                    const now = audioCtx.currentTime;
                    const startTime = Math.max(now, audioNextTimeRef.current);
                    source.start(startTime);
                    audioNextTimeRef.current = startTime + buffer.duration;
                } catch (err) {
                    // ignore decode errors
                }
            };

            audioWs.onerror = () => {
                console.warn("[audio] WebSocket error");
            };
        } catch (err) {
            console.warn("[audio] Failed to connect:", err);
        }

        return () => {
            if (audioWs) audioWs.close();
            if (audioCtx && audioCtx.state !== 'closed') {
                audioCtx.close();
            }
            audioCtxRef.current = null;
            audioNextTimeRef.current = 0;
        };
    }, [open, incident]);

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
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, letterSpacing: 0.5 }}>
                        {label} — LIVE
                    </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleFullscreen(refProp)} sx={{ color: 'text.primary' }}>
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
                {type === 'phone' && phoneStream ? (
                    <video
                        autoPlay
                        playsInline
                        muted
                        ref={v => { if (v && phoneStream) v.srcObject = phoneStream; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 10 }}
                    />
                ) : type === 'phone' && frameUrl ? (
                    <img
                        src={frameUrl}
                        alt="Live phone feed"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, zIndex: 10 }}
                    />
                ) : (
                    <>
                        {type === 'phone' ? (
                            <PhoneIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                        ) : (
                            <DroneIcon sx={{ fontSize: 64, color: 'rgba(0,255,0,0.15)', mb: 2 }} />
                        )}
                        <Typography variant="body2" color="text.secondary">
                            {type === 'phone' ? '📱 Phone Stream' : '🚁 Drone Stream'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5 }}>
                            Waiting for live feed connection...
                        </Typography>

                        {/* Simulated scan lines */}
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
                            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
                        }} />
                    </>
                )}
            </Box>

            {/* Video footer with metadata */}
            <Box sx={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                px: 1.5, py: 0.5, background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,255,255,0.1)',
            }}>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>
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
                                {incident.created_at ? format(new Date(incident.created_at), 'MMM d, yyyy, h:mm a') : 'N/A'}
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
