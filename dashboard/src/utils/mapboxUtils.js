export const createGeoJSONCircle = (center, radiusInKm, points = 64) => {
    return { type: 'FeatureCollection', features: [] };
};
export const calculateDistance = (point1, point2) => {
    return 0;
};
export default { createGeoJSONCircle, calculateDistance };
