/** Label style shared by every content field (stacked label + control). */
export const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#3a3f4b', minWidth: 0 };
/** Responsive column grid used for the fields inside one card. */
export const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 };
/** Wider variant for plain text inputs. */
export const wideGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 };
/** Single-column stack of fields. */
export const stackGrid = { display: 'grid', gap: 10 };
