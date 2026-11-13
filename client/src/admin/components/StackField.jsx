/** A label above its input, used by the blog and page editors (small bold label, optional grey hint beside it). */
export const StackField = ({ label, hint, children, style }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#3a3f4b', ...style }}>
    <span>{label}{hint && <em style={{ fontStyle: 'normal', fontWeight: 500, color: '#8a8f9b', marginLeft: 8 }}>{hint}</em>}</span>{children}
  </label>
);
