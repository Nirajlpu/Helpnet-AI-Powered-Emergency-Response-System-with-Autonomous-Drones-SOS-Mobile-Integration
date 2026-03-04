import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { fetchIncidents, selectIncident, clearSelection } from '@store/slices/incidentsSlice.js'

export const useIncidents = () => {
    const dispatch = useDispatch()
    const { items, selectedIncident, isLoading, error, stats } = useSelector(
        (state) => state.incidents
    )

    useEffect(() => {
        dispatch(fetchIncidents())
    }, [dispatch])

    return {
        incidents: items,
        selectedIncident,
        isLoading,
        error,
        stats,
        select: (incident) => dispatch(selectIncident(incident)),
        clear: () => dispatch(clearSelection()),
        refresh: () => dispatch(fetchIncidents()),
    }
}