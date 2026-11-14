import { createContext, useContext } from 'react';

/** The signed-in staff member, provided by AdminApp so deep drawers can check permissions without every caller passing them down. */
export const StaffCtx = createContext(null);
export const useStaff = () => useContext(StaffCtx);
