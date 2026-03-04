import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
    DataGrid,
    GridToolbarContainer,
    GridToolbarColumnsButton,
    GridToolbarFilterButton,
    GridToolbarExport,
    GridToolbarDensitySelector,
} from '@mui/x-data-grid'
import {
    Chip,
    IconButton,
    Button,
    Box,
    Tooltip,
} from '@mui/material'
import {
    Send as SendIcon,
    LocationOn as LocationIcon,
    AccessTime as TimeIcon,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

import { dispatchDrone } from '@store/slices/incidentsSlice.js'

const CustomToolbar = () => (
    <GridToolbarContainer>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector />
        <GridToolbarExport />
    </GridToolbarContainer>
)

const IncidentTable = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { items: incidents, isLoading } = useSelector((state) => state.incidents)

    const [paginationModel, setPaginationModel] = useState({
        pageSize: 25,
        page: 0,
    })

    const getSeverityColor = (severity) => ({
        'CRITICAL': 'error',
        'HIGH': 'warning',
        'MEDIUM': 'info',
        'LOW': 'success',
    }[severity] || 'default')

    const getStatusColor = (status) => ({
        'REPORTED': 'default',
        'DISPATCHED': 'primary',
        'EN_ROUTE': 'info',
        'ON_SCENE': 'success',
        'RESOLVED': 'success',
    }[status] || 'default')

    const columns = [
        {
            field: 'severity',
            headerName: 'Severity',
            width: 120,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    color={getSeverityColor(params.value)}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                />
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 130,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    color={getStatusColor(params.value)}
                    size="small"
                    variant="outlined"
                />
            ),
        },
        {
            field: 'created_at',
            headerName: 'Time',
            width: 150,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimeIcon fontSize="small" color="action" />
                    {formatDistanceToNow(new Date(params.value), { addSuffix: true })}
                </Box>
            ),
        },
        {
            field: 'location',
            headerName: 'Location',
            flex: 1,
            renderCell: (params) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocationIcon fontSize="small" color="action" />
                    {params.row.address || `${params.value?.coordinates?.[1]?.toFixed(4)}, ${params.value?.coordinates?.[0]?.toFixed(4)}`}
                </Box>
            ),
        },
        {
            field: 'ai_classification',
            headerName: 'AI Analysis',
            width: 200,
            renderCell: (params) => (
                params.value?.keywords_detected?.join(', ') || 'N/A'
            ),
        },
        {
            field: 'actions',
            headerName: 'Actions',
            width: 200,
            sortable: false,
            renderCell: (params) => (
                <Box>
                    {params.row.status === 'REPORTED' && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SendIcon />}
                            onClick={(e) => {
                                e.stopPropagation()
                                dispatch(dispatchDrone(params.row.id))
                            }}
                            sx={{ mr: 1 }}
                        >
                            Dispatch
                        </Button>
                    )}
                    {params.row.assigned_drones?.length > 0 && (
                        <Chip
                            label={`${params.row.assigned_drones.length} drone(s)`}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    )}
                </Box>
            ),
        },
    ]

    const handleRowClick = (params) => {
        navigate(`/incidents/${params.row.id}`)
    }

    return (
        <DataGrid
            rows={incidents}
            columns={columns}
            loading={isLoading}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 25, 50, 100]}
            onRowClick={handleRowClick}
            slots={{ toolbar: CustomToolbar }}
            sx={{
                '& .MuiDataGrid-row:hover': {
                    cursor: 'pointer',
                },
            }}
        />
    )
}

export default IncidentTable