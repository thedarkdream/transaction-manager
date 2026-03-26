// Base URL for the transaction API.
// Reads from the REACT_APP_API_BASE environment variable (set in .env).
export const API_BASE: string = process.env.REACT_APP_API_BASE ?? 'http://localhost:5000';
