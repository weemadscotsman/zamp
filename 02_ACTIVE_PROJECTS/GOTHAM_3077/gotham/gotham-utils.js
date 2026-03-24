/**
 * gotham-utils.js
 * Shared utility functions for the Gotham simulation system
 */

/**
 * Earth's radius in kilometers for distance calculations
 * @constant {number}
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Earth's radius in meters for distance calculations
 * @constant {number}
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates haversine distance between two coordinates in meters
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculates great circle distance between two points in kilometers
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function greatCircleDistance(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates initial bearing from point 1 to point 2
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Bearing in radians
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return Math.atan2(y, x);
}

/**
 * Moves a point along a great circle path
 * @param {Object} start - Starting position {lat, lon}
 * @param {Object} end - Ending position {lat, lon}
 * @param {number} distanceKm - Distance to travel in km
 * @returns {Object} New position {lat, lon}
 */
function moveAlongPath(start, end, distanceKm) {
  const R = EARTH_RADIUS_KM;
  const latRad = (start.lat * Math.PI) / 180;
  const lonRad = (start.lon * Math.PI) / 180;
  const bearingRad = calculateBearing(start.lat, start.lon, end.lat, end.lon);
  const angularDistance = distanceKm / R;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lon: (newLonRad * 180) / Math.PI
  };
}

/**
 * Clamps a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Hash a location to a string key for efficient Map storage
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} precision - Precision multiplier (default: 1000)
 * @returns {string} Hash key
 */
function hashLocation(lat, lon, precision = 1000) {
  const x = Math.round(lat * precision);
  const y = Math.round(lon * precision);
  return `${x},${y}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EARTH_RADIUS_KM,
    EARTH_RADIUS_METERS,
    haversineDistance,
    greatCircleDistance,
    calculateBearing,
    moveAlongPath,
    clamp,
    hashLocation
  };
}
