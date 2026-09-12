// CircuitVision API Configuration
// When running in local development on localhost, default to http://localhost:8005.
// When hosted in production on Vercel, default to '' (same origin) so all requests hit the deployed API.
const isLocalhost = 
  typeof window !== 'undefined' && 
  Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  );

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (isLocalhost ? 'http://localhost:8005' : '');
