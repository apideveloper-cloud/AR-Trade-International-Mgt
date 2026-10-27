# Deploying AR Trade to the live server (step by step)

Target: `/var/www/html/artradeint_mgt/` on 119.148.58.151 · domain `artradeinternational.birgroupholdings.net`

Release files (this folder, built locally):
- `artrade-release.tar.gz`  application (server code + built storefront). No node_modules, no secrets.
- `artrade-uploads.tar.gz`  product / blog / service images (~200 MB)
- `artradeint_mgt.sql`      database export (schema + data). **Contains customer data and the demo logins. Do not leave it on shared drives or in Git.**
- `ecosystem.config.cjs`, `nginx-artradeinternational.conf`, `env.production.example`

> Rebuild the release (`npm run build`, then the tar files) after any code change. A release made before the latest security fixes must not be deployed.

## 0. Before anything: DNS
`artradeinternational.birgroupholdings.net` must resolve (A record → server IP). Check: `nslookup artradeinternational.birgroupholdings.net 8.8.8.8`

## 1. Upload (from your PC)
```
scp -P 22151 artrade-release.tar.gz artrade-uploads.tar.gz artradeint_mgt.sql ecosystem.config.cjs nginx-artradeinternational.conf env.production.example root@119.148.58.151:/root/
```

## 2. On the server: prerequisites (once)
```
node -v          # needs Node 20+ ; if missing: curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && dnf install -y nodejs   (or the apt equivalent)
nginx -v         # or apache; the nginx file below is for nginx
```
Pick ONE way to run the app and stick to it: the systemd unit `artrade-api` (used on this server) **or** pm2 (`npm i -g pm2`, `ecosystem.config.cjs`). Either way the process must run with `NODE_ENV=production`
(systemd: `Environment=NODE_ENV=production` in the unit; pm2: already set in the ecosystem file; it is also in `.env` below).

## 3. Back up what is there, then unpack
```
mkdir -p /var/www/html/artradeint_mgt && cd /var/www/html/artradeint_mgt
[ -d server ] && tar czf /root/artradeint_backup_$(date +%F).tgz server client uploads 2>/dev/null
tar xzf /root/artrade-release.tar.gz            # creates ./server and ./client/dist
mkdir -p server/uploads && tar xzf /root/artrade-uploads.tar.gz -C server/
cp /root/ecosystem.config.cjs .
cd server && npm ci --omit=dev
```

## 4. Database. READ THIS FIRST
`artradeint_mgt.sql` starts every table with `DROP TABLE IF EXISTS`. Importing it **replaces everything** in the database: any orders, customers, messages or applications created on the live site since the export are lost.
- If the live database is empty/new: import it.
- If the live site has taken real orders: do NOT import. Use the data-only patch instead (`catalog-patch.sql`, made by `npm run db:patch`) or ask for a merge.
```
mysqldump -u mithu_console -p artradeint_mgt > /root/db_before_$(date +%F).sql     # ALWAYS, even if you think it is empty
mysql -u mithu_console -p artradeint_mgt < /root/artradeint_mgt.sql
```
Then lock the demo logins that came with the export (staff `admin123`, `rider123`..., customer `demo123`):
```
cd /var/www/html/artradeint_mgt/server
node scripts/lock-demo-accounts.js            # report only
node scripts/lock-demo-accounts.js --apply    # disables the demo accounts; prints a NEW random password for admin@artradeinternational.com
```
(for a brand-new empty DB: `NODE_ENV=production npm run db:setup` creates tables and ONE admin with a random password printed once. It never creates demo accounts in production.)

## 5. Configure
```
cp /root/env.production.example /var/www/html/artradeint_mgt/server/.env
nano /var/www/html/artradeint_mgt/server/.env     # DB_PASS, JWT_SECRET (openssl rand -hex 32), SITE_URL; SMTP_* if you want emails
chmod 600 /var/www/html/artradeint_mgt/server/.env
```
Without `JWT_SECRET` (24+ characters) the app refuses to start. Without `SITE_URL` canonical links, the sitemap and emails fall back to the request's Host header (the app prints a warning).
Marketing email (campaigns, the welcome series and the subscription confirmation mail) only works when both `SMTP_HOST` and `SITE_URL` are set. Until then campaigns stay "Scheduled" and new subscribers stay "Pending" (staff can confirm them in Admin > Consents).

## 6. Start
```
systemctl restart artrade-api          # or: cd /var/www/html/artradeint_mgt && pm2 start ecosystem.config.cjs && pm2 save
curl -s localhost:4000/api/bootstrap | head -c 200     # must print JSON
curl -s -o /dev/null -w "%{http_code}\n" "localhost:4000/api/uploads/%63v/x.pdf"     # must print 404
```

### Role matrix (new)
On first start the app migrates the database by itself: it creates `role_perms` and `role_log`, turns `staff.role` from an ENUM into text and renames the old roles (Super admin → Master Admin, Accounts → Accountant, Field employee → Field Officer). The MySQL user therefore needs CREATE and ALTER rights on the database for that first start (the backup in step 4 covers the rollback). Defaults per role are in `ROLE_MATRIX.md`; after the deploy sign in as the Master Admin and open **Admin > Roles** to adjust them.

## 7. Web server + HTTPS
```
cp /root/nginx-artradeinternational.conf /etc/nginx/conf.d/artradeinternational.conf
nginx -t && systemctl reload nginx
certbot --nginx -d artradeinternational.birgroupholdings.net
```
After certbot, the site must answer on https and redirect http to https (session cookies are marked Secure only over https).

## 8. Smoke test
Open the site; log in to `/admin` with the new admin password from step 4; open a product, place a test order (it is created as Unpaid; staff mark it Paid), check `/blog`.
Sign in as a rider and confirm a rider can start a trip but cannot mark an order Delivered without the OTP (that happens in the Delivery Hub).

## 9. Security checklist (do this before announcing)
- Demo accounts locked (step 4) and no staff/customer still uses `admin123`, `rider123`, `market123`, `writer123`, `field123`, `manager123`, `accounts123`, `demo123`.
- New random `JWT_SECRET`; `.env` is `chmod 600`.
- Delete `/root/artradeint_mgt.sql` and the tar files from the server once the import has been checked.
- Disable SSH root password login (use keys); close MySQL port 53306 to the internet.
- `Project_Infos/Server_Infos.md` holds root and DB passwords in plain text: change them and keep the file out of Git and out of zip files.
- Applicants' CVs live in `server/uploads/cv` and are downloaded only from Admin > Careers (Admin role). nginx also returns 404 for `/api/uploads/cv` and `/vouchers`.

## Rollback
```
systemctl stop artrade-api            # or: pm2 stop artrade-api
# restore the previous code from /root/artradeint_backup_<date>.tgz and the DB from /root/db_before_<date>.sql
```

## Updating later
Rebuild locally (`npm run build`), upload a new `artrade-release.tar.gz`, unpack over `/var/www/html/artradeint_mgt`, `cd server && npm ci --omit=dev && systemctl restart artrade-api`. Uploads and `.env` are never overwritten. Do not re-import the full SQL file on a live site.

### Upgrading from v1.0.x to v1.1.0
- Run `npm ci --omit=dev` again: the invoice PDF needs new packages (`pdfkit`, Noto Sans fonts).
- The database upgrades itself on the first start (role permissions, staff details, category pictures). Nothing to import. Back up the database first anyway.
- Roles are now permission based; the existing Master Admin stays the only Master Admin. Review **Roles** in the admin console after the first sign-in.
- Optional: set `SMTP_*` in `server/.env` to email invoices to customers (see `env.production.example`).
- Pictures are uploaded files only; web addresses are rejected by the server.

### Upgrading from v1.2.x to v1.3.0

New package `tar`: run `cd server && npm ci --omit=dev` before restarting. The `backup_log` and `backup_config` tables are created on start. Backups go to `server/backups/` (database every 6 h and uploads every 6 h, copies older than 7 days deleted; env `BACKUP_EVERY_HOURS`, `BACKUP_KEEP_DAYS`). Make sure the service user (www-data) can write to `server/`. Master Admin can change the folder on the Backups page. "Remember me" now lasts 7 days.
