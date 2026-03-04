import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
// import { fetchDrones } from '@store/slices/droneSlice';

export const useDrones = () => {
    const dispatch = useDispatch();
    const { items, isLoading, error } = useSelector((state) => state.drones || { items: [] });
    // const loadDrones = useCallback(() => dispatch(fetchDrones()), [dispatch]);
    return { drones: items, isLoading, error };
};

export default useDrones;
