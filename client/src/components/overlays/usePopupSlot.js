import { useEffect } from 'react';
import { popupClose } from '../../popupBus.js';

/** Releases the shared popup slot `name` when the popup closes or unmounts. */
export default function usePopupSlot(name, isOpen) {
  useEffect(() => { if (isOpen) return () => popupClose(name); return undefined; }, [name, isOpen]);
}
