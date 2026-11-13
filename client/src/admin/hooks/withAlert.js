import { alertBox } from '../ui.jsx';

/** Wraps an async click handler so a failed request shows the message in the console's own dialog instead of becoming an unhandled promise rejection. */
export const withAlert = fn => async (...args) => {
  try { return await fn(...args); } catch (e) { alertBox(e.message); return undefined; }
};
