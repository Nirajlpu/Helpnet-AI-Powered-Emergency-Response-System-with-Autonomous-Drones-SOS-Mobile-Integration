import { useState, useCallback } from 'react';
export const useMap = () => {
    const [viewport, setViewport] = useState({
        latitude: 37.7749,
        longitude: -122.4194,
        zoom: 10
    });
    const updateViewport = useCallback((newViewport) => {
        setViewport(prev => ({ ...prev, ...newViewport }));
    }, []);
    return { viewport, updateViewport };
};
export default useMap;
