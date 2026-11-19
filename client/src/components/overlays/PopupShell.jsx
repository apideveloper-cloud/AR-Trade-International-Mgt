/** Dimmed full-screen backdrop that closes on outside click; clicks inside the panel do not bubble. */
export default function PopupShell({ onClose, bgClass = '', panelClass, children }) {
  return (
    <div className={('pop-bg ' + bgClass).trim()} onClick={onClose}>
      <div className={panelClass} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}
