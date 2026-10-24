# AR Trade Admin Console: role matrix (default access)

This is the **starting** access for each role. The Master Admin can change any tick (except Master Admin itself) in **Admin Console > Roles**; the live matrix is stored in the database table `role_perms` and every change is logged in `role_log`.
Regenerate this file from the code defaults with `npm run docs:roles` (in `server/`).

## Roles

| Role | What it is for |
|---|---|
| **Master Admin** | Full access to everything. The only role that can edit the role matrix. |
| **Admin** | Limited access: exactly what the Master Admin grants here. |
| **Manager** | Runs daily operations: orders, deliveries, approvals. |
| **Accountant** | Money side: order values, rider cash, expense claims. |
| **Purchase Officer** | Buying and stock: products, prices and stock levels. |
| **RM** | Relationship Manager: customers, enquiries, reviews and campaigns. |
| **Field Officer** | Works in the mobile app (attendance, tracking, expenses). No admin console pages by default. |
| **Delivery rider** (existing role) | Existing role: sees pick-up orders and runs own deliveries. |
| **Marketing manager** (existing role) | Existing role: campaigns, subscribers, inbox, reviews. |
| **Content writer** (existing role) | Existing role: blog and site pages. |

## Matrix

✔ = allowed. The Master Admin column is fixed. "Edit this role matrix" belongs to the Master Admin only and can never be granted.

| Permission | Master Admin | Admin | Manager | Accountant | Purchase Officer | RM | Field Officer | Delivery rider | Marketing manager | Content writer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Overview** | | | | | | | | | | |
| See the dashboard and sales figures (`dashboard.view`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |
| **Sales** | | | | | | | | | | |
| View orders (`orders.view`) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |  | ✔ |  |  |
| Change an order's status (`orders.status`) | ✔ | ✔ | ✔ |  |  |  |  | ✔ |  |  |
| Delete cancelled orders (`orders.delete`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| View customers (`customers.view`) | ✔ | ✔ | ✔ | ✔ |  | ✔ |  |  |  |  |
| Reset customer passwords (`customers.manage`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| **Catalog** | | | | | | | | | | |
| View products and categories (`products.view`) | ✔ | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |
| Create, edit, hide products and change stock / price (`products.manage`) | ✔ | ✔ |  |  | ✔ |  |  |  |  |  |
| Show or hide categories (`categories.manage`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| **Delivery** | | | | | | | | | | |
| Delivery Hub board, returns and branches (`hub.view`) | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |
| Assign riders / couriers, cancel orders, decide returns (`hub.dispatch`) | ✔ | ✔ | ✔ |  |  |  |  |  |  |  |
| Run own deliveries (rider app) (`hub.deliver`) | ✔ | ✔ |  |  |  |  |  | ✔ |  |  |
| Confirm rider cash deposits (`hub.cash`) | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| **Engage** | | | | | | | | | | |
| Service requests (`services.manage`) | ✔ | ✔ | ✔ |  |  | ✔ |  |  |  |  |
| Write and publish blog articles (`blog.manage`) | ✔ | ✔ |  |  |  |  |  |  |  | ✔ |
| Edit site pages and storefront content (`pages.manage`) | ✔ | ✔ |  |  |  |  |  |  |  | ✔ |
| Delete site pages (`pages.delete`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| Upload images (`media.upload`) | ✔ | ✔ |  |  | ✔ |  |  |  |  | ✔ |
| Approve or reject product reviews (`reviews.moderate`) | ✔ | ✔ | ✔ |  |  | ✔ |  |  | ✔ |  |
| Read and delete inbox and chat messages (`messages.manage`) | ✔ | ✔ | ✔ |  |  | ✔ |  |  | ✔ |  |
| Subscribers, campaigns and the Email Center (`marketing.manage`) | ✔ | ✔ |  |  |  | ✔ |  |  | ✔ |  |
| Email provider keys and sender address (`marketing.setup`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| Jobs, applications and applicants' CVs (`careers.manage`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| **Field & mobile app** | | | | | | | | | | |
| Approve expense claims and see live staff tracking (`field.approve`) | ✔ | ✔ | ✔ | ✔ |  |  |  |  |  |  |
| **System** | | | | | | | | | | |
| Approve staff accounts and set their roles (`team.manage`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| Store settings (fees, coupons, payments, contact) (`settings.manage`) | ✔ | ✔ |  |  |  |  |  |  |  |  |
| Edit this role matrix (`roles.manage`) | ✔ |  |  |  |  |  |  |  |  |  |

## Rules that always apply

- Only the **Master Admin** can open the role matrix, make someone a Master Admin or an Admin, or change an Admin. There must always be one active Master Admin.
- Admin and every other role get exactly the ticks set in the matrix; a role with no ticks (Field Officer by default) sees no console pages.
- Changes apply on the person's next click; no sign-out is needed.
- The mobile app treats Master Admin / Admin as *admin*, Manager as *manager*, Accountant as *accounts* and every other role as *employee*. Approving expense claims and seeing live staff tracking needs the "Field & mobile app" permission.
- Riders (anyone who can run deliveries but has no dispatch board) only see their own deliveries and cannot close one without the OTP or signature.
- The stricter checks on each action (own records only, no self-approval of expenses, one active Master Admin) are in the server code and are not affected by the matrix.
