export function haversineNm(a, b) {
  const R = 3440.065;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

export function bearing(a, b) {
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

export function circularMean(degrees) {
  const s = degrees.reduce((a, d) => a + Math.sin(d * Math.PI / 180), 0);
  const c = degrees.reduce((a, d) => a + Math.cos(d * Math.PI / 180), 0);
  const m = Math.atan2(s, c) * 180 / Math.PI;
  return m < 0 ? m + 360 : m;
}

export function angleDiff(a, b) {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function fmtDist(nm) {
  if (nm < 0.1) return `${Math.round(nm * 1852)}m`;
  return `${nm.toFixed(2)}nm`;
}
