import { useEffect, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { setCenter, selectIncidentOnMap } from '@store/slices/mapSlice.js'

const getSeverityColor = (severity) => {
    const colors = {
        'CRITICAL': '#ff4444',
        'HIGH': '#ff8800',
        'MEDIUM': '#ffcc00',
        'LOW': '#00cc00',
    }
    return colors[severity] || '#999'
}

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

const DroneMap = () => {
    const mapContainer = useRef(null)
    const map = useRef(null)
    const markersRef = useRef([])
    const tileLayerRef = useRef(null)
    const [mapStyle, setMapStyle] = useState('street') // 'street' | 'satellite'

    const dispatch = useDispatch()
    const { items: incidents = [] } = useSelector((state) => state.incidents || {})
    const themeMode = useSelector((state) => state.ui.themeMode)

    // Initialize Leaflet map
    useEffect(() => {
        if (map.current) return

        map.current = L.map(mapContainer.current, {
            center: [20.5937, 78.9629], // India center (lat, lng for Leaflet)
            zoom: 5,
            zoomControl: false,
            attributionControl: false,
        })

        // Initial tile layer based on current theme
        tileLayerRef.current = L.tileLayer(
            themeMode === 'dark' ? DARK_TILES : LIGHT_TILES,
            { maxZoom: 19 }
        ).addTo(map.current)

        map.current.on('move', () => {
            const center = map.current.getCenter()
            dispatch(setCenter([center.lng, center.lat]))
        })

        return () => {
            map.current?.remove()
            map.current = null
        }
    }, [])

    // Swap tile layer when theme or map style changes
    useEffect(() => {
        if (!map.current || !tileLayerRef.current) return
        map.current.removeLayer(tileLayerRef.current)
        const url = mapStyle === 'satellite' ? SATELLITE_TILES
            : (themeMode === 'dark' ? DARK_TILES : LIGHT_TILES)
        tileLayerRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(map.current)
    }, [themeMode, mapStyle])

    // Update markers when incidents change
    useEffect(() => {
        if (!map.current) return

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove())
        markersRef.current = []

        // Add incident markers with popups
        incidents.forEach(incident => {
            if (!incident.location?.coordinates) return

            const [lng, lat] = incident.location.coordinates
            const severityColor = getSeverityColor(incident.severity)

            // Custom pulsing circle marker icon
            const iconHtml = `
                <div style="
                    width: 24px; height: 24px;
                    background: ${severityColor};
                    border: 2px solid #fff;
                    border-radius: 50%;
                    box-shadow: 0 0 12px ${severityColor}, 0 0 24px ${severityColor}44;
                    position: relative;
                    cursor: pointer;
                ">
                    <div style="
                        position: absolute; top: -6px; left: -6px;
                        width: 36px; height: 36px;
                        border-radius: 50%;
                        border: 2px solid ${severityColor};
                        animation: radar-pulse 2s infinite;
                        pointer-events: none;
                    "></div>
                </div>
            `

            const icon = L.divIcon({
                html: iconHtml,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -16],
            })

            const marker = L.marker([lat, lng], { icon }).addTo(map.current)

            // Popup with incident details + clickable button
            const popupContent = `
                <div style="font-family: 'Inter', sans-serif; min-width: 220px; color: #e0e0e0;">
                    <h3 style="margin: 0 0 8px 0; color: ${severityColor}; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${severityColor}; box-shadow: 0 0 6px ${severityColor}"></span>
                        ${incident.severity || 'UNKNOWN'} Priority
                    </h3>
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #fff;">
                        ${incident.title || incident.description?.split('.')[0] || 'Emergency Detected'}
                    </p>
                    <div style="font-size: 11px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; margin-bottom: 10px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:#aaa">Status</span>
                            <span style="color:#4caf50; font-weight:600">${incident.status}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="color:#aaa">Location</span>
                            <span>${incident.address || incident.location_name || lat.toFixed(3) + ', ' + lng.toFixed(3)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#aaa">Reported</span>
                            <span>${incident.created_at ? new Date(incident.created_at).toLocaleTimeString() : 'N/A'}</span>
                        </div>
                    </div>
                    <button
                        class="popup-view-btn"
                        data-incident-id="${incident.id}"
                        style="
                            width: 100%; padding: 8px 0; border: none; border-radius: 6px;
                            background: ${severityColor}; color: #fff; font-weight: 700;
                            font-size: 12px; cursor: pointer; letter-spacing: 0.5px;
                            transition: all 0.2s;
                        "
                        onmouseover="this.style.opacity='0.85'; this.style.transform='scale(1.02)'"
                        onmouseout="this.style.opacity='1'; this.style.transform='scale(1)'"
                    >
                        View Incident →
                    </button>
                </div>
            `

            marker.bindPopup(popupContent, {
                className: 'radar-popup',
                closeButton: false,
                maxWidth: 280,
            })

            marker.on('click', () => {
                dispatch(selectIncidentOnMap(incident.id))
            })

            // When popup opens, bind the button click
            marker.on('popupopen', () => {
                const btn = document.querySelector(`.popup-view-btn[data-incident-id="${incident.id}"]`)
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation()
                        window.open(`/incidents/${incident.id}/video`, '_blank')
                    })
                }
            })

            markersRef.current.push(marker)
        })

        // Fit bounds if incidents exist
        if (incidents.length > 0) {
            const validCoords = incidents
                .filter(i => i.location?.coordinates)
                .map(i => [i.location.coordinates[1], i.location.coordinates[0]])

            if (validCoords.length > 0) {
                map.current.fitBounds(L.latLngBounds(validCoords).pad(0.3))
            }
        }
    }, [incidents])


    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#051005' }}>
            <style>
                {`
                @keyframes radar-pulse {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                @keyframes radar-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                /* Leaflet popup styling */
                .radar-popup .leaflet-popup-content-wrapper {
                    background: rgba(5, 20, 5, 0.95) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    border: 1px solid rgba(0,255,0,0.4) !important;
                    box-shadow: 0 0 20px rgba(0,255,0,0.2) !important;
                    backdrop-filter: blur(10px) !important;
                }
                .radar-popup .leaflet-popup-tip {
                    background: rgba(5, 20, 5, 0.95) !important;
                    border: 1px solid rgba(0,255,0,0.3) !important;
                }
                .radar-popup .leaflet-popup-content {
                    margin: 10px 12px !important;
                }

                /* Hide Leaflet default controls inside radar */
                .leaflet-control-container { display: none !important; }
                
                .radar-grid {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-image: 
                        linear-gradient(rgba(0, 255, 0, 0.15) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0, 255, 0, 0.15) 1px, transparent 1px);
                    background-size: 40px 40px;
                    pointer-events: none;
                    z-index: 400;
                }
                .radar-circles {
                    position: absolute;
                    top: 50%; left: 50%;
                    width: 450px; height: 450px;
                    margin-top: -225px; margin-left: -225px;
                    background-image: repeating-radial-gradient(
                        circle,
                        transparent,
                        transparent 39px,
                        rgba(0, 255, 0, 0.3) 40px,
                        transparent 41px
                    );
                    pointer-events: none;
                    z-index: 400;
                }
                .radar-crosshairs {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    pointer-events: none;
                    z-index: 400;
                }
                .radar-crosshairs::before {
                    content: '';
                    position: absolute;
                    top: 50%; left: 0; right: 0;
                    height: 1px;
                    background: rgba(0, 255, 0, 0.5);
                }
                .radar-crosshairs::after {
                    content: '';
                    position: absolute;
                    left: 50%; top: 0; bottom: 0;
                    width: 1px;
                    background: rgba(0, 255, 0, 0.5);
                }
                `}
            </style>

            <div
                ref={mapContainer}
                style={{
                    width: '100%',
                    height: '100%',
                    opacity: 0.55,
                }}
            />

            <div className="radar-grid" />
            <div className="radar-circles" />
            <div className="radar-crosshairs" />

            {/* Radar Sweep */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 450,
                height: 450,
                marginTop: -225,
                marginLeft: -225,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, rgba(0,255,0,0) 70%, rgba(0,255,0,0.1) 85%, rgba(0,255,0,0.8) 100%)',
                animation: 'radar-spin 4s linear infinite',
                pointerEvents: 'none',
                mixBlendMode: 'screen',
                zIndex: 401
            }} />

            {/* Center dot */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 8,
                height: 8,
                marginTop: -4,
                marginLeft: -4,
                borderRadius: '50%',
                background: '#0f0',
                boxShadow: '0 0 10px #0f0',
                pointerEvents: 'none',
                zIndex: 401
            }} />

            {/* Map Style Toggle */}
            <div style={{
                position: 'absolute', top: 10, right: 10, zIndex: 500,
                display: 'flex', borderRadius: 6, overflow: 'hidden',
                border: '1px solid rgba(0,255,0,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>
                {[
                    { key: 'street', label: '🗺️' },
                    { key: 'satellite', label: '🛰️' },
                ].map((opt) => (
                    <div
                        key={opt.key}
                        onClick={() => setMapStyle(opt.key)}
                        style={{
                            padding: '4px 8px', fontSize: '14px', cursor: 'pointer',
                            background: mapStyle === opt.key ? 'rgba(0,255,0,0.25)' : 'rgba(5,16,5,0.85)',
                            color: '#fff', transition: 'all 0.2s',
                            borderRight: opt.key === 'street' ? '1px solid rgba(0,255,0,0.2)' : 'none',
                        }}
                    >
                        {opt.label}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default DroneMap