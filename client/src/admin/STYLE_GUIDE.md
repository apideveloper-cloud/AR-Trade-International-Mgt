# Admin console UI style guide

How a page in the admin console is built, so new pages look like the old ones. Everything below already exists as a shared component or stylesheet: reuse it, do not rebuild it.

## Page order (top to bottom)

1. **Summary cards**: `<Summary items={[title, value, sub, tone, icon]} />` from `ui.jsx`. Four to six cards. Tones: `blue | green | amber | violet | red`.
2. **Filter card**: `<ListFilter />` (`ListFilter.jsx`) for a list with a database behind it: search box, drop-downs, a date period (Today / Last 7 days / This month / Last 30 days / All time and a from-to), an optional amount range, Reset. It is one dark header plus white fields; do not make a new filter bar.
3. **Rows per page**: `<Toolbar t={table} search={false} />` (`ui.jsx`). With `search={false}` it is drawn as a slim line (count and page size), not as another white card.
4. **Table** inside a card, then `<Pager t={table} />`.

Pages that are not lists (Dashboard, Settings, Content, Roles) keep their own layout but still use the same cards, buttons and colours.

## Lists: the server does the work

- Use `useTable(path, initialParams, [], api)` (`adminApi.js`). It sends `page`, `size`, `q`, `from`, `to` and your own keys; the server answers `{ total, rows, ... }`.
- On the server use `listing.js`: `pageOf`, `addRange`, `addSearch`, `whereOf`, `wantsPage`. Never load a whole table and filter it in the browser.
- `fld` endpoints (`/api/field/*`) are shared with the mobile app: only add optional parameters, never change what they return when no page is asked for.
- `fieldKit.Grid` takes `server={table}` for one server page; without it, it pages a small list in the browser.

## Tables: one look

Three markups exist (`.a-table` with `.head`/`.row`, `.fd-tbl` via `Grid`, and `table.dt`). They share one look, written once at the end of `admin.css` (block "One look for every table"): header in small mono capitals on a pale blue band, rows 6px / 14px, 13px text, pale divider, light hover. Change the look there, not per page.

## Buttons and chips

| Use | Class |
|---|---|
| Main action on a page or dialog | `a-btn grad` (small: `a-btn sm grad`) |
| Other action | `a-btn`, `a-btn ghost` |
| Action inside a table row or card | `a-mini` (`ok`, `bad`, `on` for tone) |
| Row icon button (key, lock) | `cu-ic` |
| Status pill in a table | `<Pill s=...>` or `<Chip tone=...>` |
| Tabs / filters as pills | `<Tabs>` (`fieldKit.jsx`) or `a-chip` |

Destructive actions always ask first with `confirmBox(..., { danger: true })`. A status change always asks for remarks (`sales/StatusDialog.jsx`).

## Dialogs and drawers

- `Modal` for short forms (add `narrow`), `Drawer` for the details of one record.
- Open a second drawer **next to** the first one, never inside it (a scrim inside a drawer sits above the drawer and greys it out).
- A detail panel uses the `od-*` cards in `pages/sales/orders.css`: hero card, cards with an upper-case heading, icon rows.

## Rules of thumb

- Dates and money: `fDate`, `fDateTime`, `taka` / `fmtMoney`, Dhaka time.
- Empty state: say what is empty and what to do (`dq-empty`, `a-empty`).
- Every field in a form is 34-42px high; labels are small upper-case.
- Replies, labels and messages for staff are in English; Bangla text only where the data is Bangla.
- Per-feature styles live next to the feature (`pages/sales/orders.css`, `pages/inventory/inventory.css`, `filterCard.css`), not at the bottom of `admin.css`.
