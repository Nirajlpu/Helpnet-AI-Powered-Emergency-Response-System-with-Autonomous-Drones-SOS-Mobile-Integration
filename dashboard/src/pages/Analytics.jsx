import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, CircularProgress, Alert, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup, Divider, LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Speed as SpeedIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Shield as ShieldIcon,
  LocalPolice as PoliceIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut, Pie, Line } from 'react-chartjs-2';
import { incidentService } from '../services/incidentService';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
);

const SEVERITY_COLORS = { LOW: '#4caf50', MEDIUM: '#ff9800', HIGH: '#f44336', CRITICAL: '#9c27b0' };
const STATUS_COLORS = { REPORTED: '#2196f3', DISPATCHED: '#ff9800', EN_ROUTE: '#ff5722', ON_SCENE: '#9c27b0', RESOLVED: '#4caf50' };

/* ──── Stat Card ──── */
const StatCard = ({ title, value, icon, color, subtitle }) => (
  <Paper sx={{ p: 2.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: 'divider' }}>
    <Avatar sx={{ bgcolor: color + '22', color, width: 48, height: 48 }}>{icon}</Avatar>
    <Box>
      <Typography variant="h5" fontWeight={700}>{value ?? '—'}</Typography>
      <Typography variant="body2" color="text.secondary">{title}</Typography>
      {subtitle && <Typography variant="caption" color="text.disabled">{subtitle}</Typography>}
    </Box>
  </Paper>
);

/* ──── Chart wrapper ──── */
const ChartCard = ({ title, children, sx }) => (
  <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column', ...sx }}>
    <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>{title}</Typography>
    <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</Box>
  </Paper>
);

const chartOptions = (opts = {}) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 } },
    ...opts.plugins,
  },
  ...opts,
});

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendView, setTrendView] = useState('daily');

  useEffect(() => {
    incidentService.getAnalytics()
      .then(res => setData(res.data ?? res))
      .catch(err => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false));
  }, []);

  /* ─── Derived chart data ─── */
  const charts = useMemo(() => {
    if (!data) return {};

    // Severity doughnut
    const severityDoughnut = {
      labels: Object.keys(data.by_severity),
      datasets: [{
        data: Object.values(data.by_severity),
        backgroundColor: Object.keys(data.by_severity).map(k => SEVERITY_COLORS[k] || '#9e9e9e'),
        borderWidth: 0,
      }],
    };

    // Type bar
    const typeBar = {
      labels: Object.keys(data.by_type).map(k => k.replace(/_/g, ' ')),
      datasets: [{
        label: 'Incidents',
        data: Object.values(data.by_type),
        backgroundColor: '#1976d2',
        borderRadius: 4,
      }],
    };

    // Status doughnut
    const statusDoughnut = {
      labels: Object.keys(data.by_status),
      datasets: [{
        data: Object.values(data.by_status),
        backgroundColor: Object.keys(data.by_status).map(k => STATUS_COLORS[k] || '#9e9e9e'),
        borderWidth: 0,
      }],
    };

    // Action taken pie
    const actionPie = {
      labels: Object.keys(data.by_action).map(k => k.replace(/_/g, ' ')),
      datasets: [{
        data: Object.values(data.by_action),
        backgroundColor: ['#2196f3', '#ff9800', '#9c27b0', '#4caf50', '#f44336', '#795548'],
        borderWidth: 0,
      }],
    };

    // Medium pie
    const mediumPie = {
      labels: Object.keys(data.by_medium).map(k => k.replace(/_/g, ' ')),
      datasets: [{
        data: Object.values(data.by_medium),
        backgroundColor: ['#e91e63', '#00bcd4', '#ff5722', '#8bc34a', '#3f51b5', '#607d8b'],
        borderWidth: 0,
      }],
    };

    // Daily trend line
    const dailyTrend = {
      labels: data.daily_trend.map(e => e.date.slice(5)),
      datasets: [{
        label: 'Incidents / day',
        data: data.daily_trend.map(e => e.count),
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25,118,210,0.1)',
        fill: true, tension: 0.3, pointRadius: 3,
      }],
    };

    // Monthly trend
    const monthlyTrend = {
      labels: data.monthly_trend.map(e => e.month.slice(0, 7)),
      datasets: [{
        label: 'Incidents / month',
        data: data.monthly_trend.map(e => e.count),
        borderColor: '#9c27b0',
        backgroundColor: 'rgba(156,39,176,0.1)',
        fill: true, tension: 0.3, pointRadius: 4,
      }],
    };

    // Severity trend (multi-line)
    const allSeverityDates = [...new Set(data.severity_trend.flatMap(s => s.data.map(d => d.date.slice(5))))].sort();
    const severityTrendData = {
      labels: allSeverityDates,
      datasets: data.severity_trend.map(s => {
        const dateMap = Object.fromEntries(s.data.map(d => [d.date.slice(5), d.count]));
        return {
          label: s.severity,
          data: allSeverityDates.map(d => dateMap[d] || 0),
          borderColor: SEVERITY_COLORS[s.severity],
          backgroundColor: SEVERITY_COLORS[s.severity] + '22',
          tension: 0.3, pointRadius: 2,
        };
      }),
    };

    // Hotspot bars (pincode)
    const hotspotPincode = {
      labels: data.hotspot_pincode.map(h => h.pincode || 'Unknown'),
      datasets: [{
        label: 'Incidents',
        data: data.hotspot_pincode.map(h => h.count),
        backgroundColor: '#e53935',
        borderRadius: 4,
      }],
    };

    // Hotspot district
    const hotspotDistrict = {
      labels: data.hotspot_district.map(h => h.district || 'Unknown'),
      datasets: [{
        label: 'Incidents',
        data: data.hotspot_district.map(h => h.count),
        backgroundColor: '#ff6f00',
        borderRadius: 4,
      }],
    };

    // Hotspot state
    const hotspotState = {
      labels: data.hotspot_state.map(h => h.state || 'Unknown'),
      datasets: [{
        label: 'Incidents',
        data: data.hotspot_state.map(h => h.count),
        backgroundColor: '#1565c0',
        borderRadius: 4,
      }],
    };

    // Suspect risk pie
    const suspectRisk = {
      labels: Object.keys(data.suspect_stats.by_risk),
      datasets: [{
        data: Object.values(data.suspect_stats.by_risk),
        backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
        borderWidth: 0,
      }],
    };

    // User role bar
    const userRole = {
      labels: Object.keys(data.user_stats.by_role).map(k => k.replace(/_/g, ' ')),
      datasets: [{
        label: 'Users',
        data: Object.values(data.user_stats.by_role),
        backgroundColor: '#00897b',
        borderRadius: 4,
      }],
    };

    return {
      severityDoughnut, typeBar, statusDoughnut, actionPie, mediumPie,
      dailyTrend, monthlyTrend, severityTrendData,
      hotspotPincode, hotspotDistrict, hotspotState,
      suspectRisk, userRole,
    };
  }, [data]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress size={48} />
    </Box>
  );

  if (error) return <Alert severity="error" sx={{ m: 3 }}>Failed to load analytics: {error}</Alert>;
  if (!data) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>📊 Analytics Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Comprehensive incident data visualization and insights
      </Typography>

      {/* ══════ Overview Cards ══════ */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Total Incidents" value={data.overview.total} icon={<TrendingUpIcon />} color="#1976d2" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Active" value={data.overview.active} icon={<WarningIcon />} color="#f44336" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Resolved" value={data.overview.resolved} icon={<CheckCircleIcon />} color="#4caf50" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard title="Avg Resolution" value={data.overview.avg_resolution_hours ? `${data.overview.avg_resolution_hours}h` : '—'}
            icon={<SpeedIcon />} color="#ff9800" subtitle="hours" />
        </Grid>
      </Grid>

      {/* ══════ Row 1: Severity + Status + Action ══════ */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="Incidents by Severity">
            <Doughnut data={charts.severityDoughnut} options={chartOptions({ cutout: '55%' })} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="Incidents by Status">
            <Doughnut data={charts.statusDoughnut} options={chartOptions({ cutout: '55%' })} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="Action Taken Distribution">
            <Pie data={charts.actionPie} options={chartOptions()} />
          </ChartCard>
        </Grid>
      </Grid>

      {/* ══════ Row 2: Type bar + Medium ══════ */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <ChartCard title="Incidents by Type" sx={{ minHeight: 340 }}>
            <Bar data={charts.typeBar} options={chartOptions({
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            })} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="Reported Medium">
            <Pie data={charts.mediumPie} options={chartOptions()} />
          </ChartCard>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* ══════ Trend Section ══════ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TimelineIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>Incident Trends</Typography>
        <ToggleButtonGroup value={trendView} exclusive onChange={(_, v) => v && setTrendView(v)} size="small" sx={{ ml: 'auto' }}>
          <ToggleButton value="daily">Daily (30d)</ToggleButton>
          <ToggleButton value="monthly">Monthly (12m)</ToggleButton>
          <ToggleButton value="severity">By Severity</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3, height: 320 }}>
        {trendView === 'daily' && <Line data={charts.dailyTrend} options={chartOptions({
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          plugins: { legend: { display: false } },
        })} />}
        {trendView === 'monthly' && <Line data={charts.monthlyTrend} options={chartOptions({
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          plugins: { legend: { display: false } },
        })} />}
        {trendView === 'severity' && <Line data={charts.severityTrendData} options={chartOptions({
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
        })} />}
      </Paper>

      <Divider sx={{ my: 3 }} />

      {/* ══════ Hotspot / Area Analysis ══════ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <LocationIcon color="error" />
        <Typography variant="h6" fontWeight={600}>Hotspot Areas — Where Incidents Happen Most</Typography>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="By Pincode" sx={{ minHeight: 300 }}>
            {data.hotspot_pincode.length > 0 ? (
              <Bar data={charts.hotspotPincode} options={chartOptions({
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
              })} />
            ) : <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>No data yet</Typography>}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="By District" sx={{ minHeight: 300 }}>
            {data.hotspot_district.length > 0 ? (
              <Bar data={charts.hotspotDistrict} options={chartOptions({
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
              })} />
            ) : <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>No data yet</Typography>}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="By State" sx={{ minHeight: 300 }}>
            {data.hotspot_state.length > 0 ? (
              <Bar data={charts.hotspotState} options={chartOptions({
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
              })} />
            ) : <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>No data yet</Typography>}
          </ChartCard>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* ══════ People: Reporters + Authority Participation ══════ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <PersonIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>People Analytics</Typography>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Top Reporters */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>📋 Top Reporters</Typography>
            {data.top_reporters.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell align="right">Incidents</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.top_reporters.map((r, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'primary.main' }}>
                              {(r.reporter_profile__first_name || '?')[0]}
                            </Avatar>
                            {r.reporter_profile__first_name} {r.reporter_profile__last_name}
                          </Box>
                        </TableCell>
                        <TableCell><Chip label={r.reporter_profile__user_id_code} size="small" variant="outlined" /></TableCell>
                        <TableCell>{r.reporter_profile__phone || '—'}</TableCell>
                        <TableCell align="right"><Chip label={r.count} size="small" color="primary" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : <Typography color="text.secondary">No data yet</Typography>}
          </Paper>
        </Grid>

        {/* Authority Participation */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>⚖️ Authority / Volunteer Participation</Typography>
            {data.authority_participation.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell align="right">Actions Taken</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.authority_participation.map((a, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: 'secondary.main' }}>
                              {(a.which_authority_took_action__first_name || '?')[0]}
                            </Avatar>
                            {a.which_authority_took_action__first_name} {a.which_authority_took_action__last_name}
                          </Box>
                        </TableCell>
                        <TableCell><Chip label={a.which_authority_took_action__role?.replace(/_/g, ' ')} size="small" variant="outlined" /></TableCell>
                        <TableCell><Chip label={a.which_authority_took_action__user_id_code} size="small" variant="outlined" /></TableCell>
                        <TableCell align="right"><Chip label={a.count} size="small" color="secondary" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : <Typography color="text.secondary">No data yet</Typography>}
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* ══════ Volunteers + Responders + Suspects ══════ */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Volunteer Stats */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <GroupIcon sx={{ color: '#00897b' }} />
              <Typography variant="subtitle1" fontWeight={600}>Volunteer Stats</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Total Volunteers</Typography>
                <Typography variant="h4" fontWeight={700} color="#00897b">{data.volunteer_stats.total_volunteers}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Verified</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" fontWeight={700}>{data.volunteer_stats.verified_volunteers}</Typography>
                  {data.volunteer_stats.total_volunteers > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      ({Math.round((data.volunteer_stats.verified_volunteers / data.volunteer_stats.total_volunteers) * 100)}%)
                    </Typography>
                  )}
                </Box>
                {data.volunteer_stats.total_volunteers > 0 && (
                  <LinearProgress variant="determinate"
                    value={(data.volunteer_stats.verified_volunteers / data.volunteer_stats.total_volunteers) * 100}
                    sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: '#00897b' } }} />
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Top Responders */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <ShieldIcon sx={{ color: '#1565c0' }} />
              <Typography variant="subtitle1" fontWeight={600}>
                Responders ({data.responder_stats.available}/{data.responder_stats.total} available)
              </Typography>
            </Box>
            {data.responder_stats.top_responders.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {data.responder_stats.top_responders.slice(0, 5).map((r, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: '#1565c0' }}>
                        {(r.user__first_name || '?')[0]}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>{r.user__first_name} {r.user__last_name}</Typography>
                        <Typography variant="caption" color="text.secondary">⭐ {r.rating?.toFixed(1)}</Typography>
                      </Box>
                    </Box>
                    <Chip label={`${r.response_count} responses`} size="small" variant="outlined" />
                  </Box>
                ))}
              </Box>
            ) : <Typography color="text.secondary">No responders yet</Typography>}
          </Paper>
        </Grid>

        {/* Suspect Overview */}
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PoliceIcon sx={{ color: '#e53935' }} />
              <Typography variant="subtitle1" fontWeight={600}>Suspect Database</Typography>
            </Box>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>{data.suspect_stats.total}</Typography>
            {data.suspect_stats.total > 0 ? (
              <Box sx={{ height: 180 }}>
                <Doughnut data={charts.suspectRisk} options={chartOptions({ cutout: '50%' })} />
              </Box>
            ) : <Typography color="text.secondary">No suspects in database</Typography>}
          </Paper>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* ══════ User Overview ══════ */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <GroupIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>User Overview ({data.user_stats.total_users} total)</Typography>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Users by Role" sx={{ minHeight: 300 }}>
            <Bar data={charts.userRole} options={chartOptions({
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            })} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>🗺️ Incident Geo Points</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {data.heatmap_points.length} geo-located incidents
            </Typography>
            {data.heatmap_points.length > 0 ? (
              <TableContainer sx={{ maxHeight: 250 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Latitude</TableCell>
                      <TableCell>Longitude</TableCell>
                      <TableCell>Maps</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.heatmap_points.slice(0, 20).map((pt, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{pt.lat.toFixed(4)}</TableCell>
                        <TableCell>{pt.lng.toFixed(4)}</TableCell>
                        <TableCell>
                          <a href={`https://www.google.com/maps?q=${pt.lat},${pt.lng}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ color: '#1976d2', fontSize: '0.8rem' }}>
                            Open ↗
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : <Typography color="text.secondary">No geo data available</Typography>}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
