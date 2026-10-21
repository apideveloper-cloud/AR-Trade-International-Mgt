# Deploying AR Trade to the live server (step by step)

Target: `/var/www/html/artradeint_mgt/` on 119.148.58.151 · domain `artradeinternational.birgroupholdings.net`

Release files (this folder, built locally):
- `artrade-release.tar.gz`  application (server code + built storefront). No node_modules, no secrets.
- `artrade-uploads.tar.gz`  product / blog / service images (~200 MB)
- `artradeint_mgt.sql`      database export (schema + data: 2,102 products, 124 orders, 164 customers, blog…)
- `ecosystem.config.cjs`, `nginx-artradeinternational.conf`, `env.production.example`

## 0. Before anything: DNS
`artradeinternational.birgroupholdings.net` must resolve (A record → server IP). Check: `nslookup artradeinternational.birgroupholdings.net 8.8.8.8`

## 1. Upload (from your PC)
```
scp -P 22151 artrade-release.tar.gz artrade-uploads.tar.gz artradeint_mgt.sql ecosystem.config.cjs nginx-artradeinternational.conf env.production.example root@119.148.58.151:/root/
```

## 2. On the server: prerequisites (once)
```
node -v          # needs Node 20+ ; if missing: curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && dnf install -y nodejs   (or the apt equivalent)
npm i -g pm2
nginx -v         # or apache; the nginx file below is for nginx
```

## 3. Back up what is there, then unpack
```
mkdir -p /var/www/html/artradeint_mgt && cd /var/www/html/artradeint_mgt
[ -d server ] && tar czf /root/artradeint_backup_$(date +%F).tgz server client uploads 2>/dev/null
tar xzf /root/artrade-release.tar.gz            # creates ./server and ./client/dist
mkdir -p server/uploads && tar xzf /root/artrade-uploads.tar.gz -C server/
cp /root/ecosystem.config.cjs .
cd server && npm ci --omit=dev
```

## 4. Database (backup first if it already has data)
```
mysqldump -u mithu_console -p artradeint_mgt > /root/db_before_$(date +%F).sql   # skip if the DB is empty/new
mysql -u mithu_console -p artradeint_mgt < /root/artradeint_mgt.sql
```
(or, for a brand-new empty DB: `npm run db:setup` then `npm run import:site` and `npm run migrate:wp` — the SQL file is the quick way.)

## 5. Configure
```
cp /root/env.production.example /var/www/html/artradeint_mgt/server/.env
nano /var/www/html/artradeint_mgt/server/.env     # set DB_PASS, JWT_SECRET (openssl rand -hex 32)
chmod 600 /var/www/html/artradeint_mgt/server/.env
```

## 6. Start
```
cd /var/www/html/artradeint_mgt && (on the live server the service is the systemd unit artrade-api: systemctl restart artrade-api)
curl -s localhost:4000/api/bootstrap | head -c 200     # must print JSON
```

## 7. Web server + HTTPS
```
cp /root/nginx-artradeinternational.conf /etc/nginx/conf.d/artradeinternational.conf
nginx -t && systemctl reload nginx
certbot --nginx -d artradeinternational.birgroupholdings.net
```

## 8. Smoke test
Open the site; log in to `/admin` (change the demo staff passwords first: admin@artradeinternational.com / admin123 etc.), open a product, place a test order, check `/blog`.

## 9. Security checklist (do this before announcing)
- Change ALL demo passwords (staff: admin123, rider123, market123, writer123; customer demo123) or delete the demo accounts.
- Use a new JWT_SECRET (never the dev one).
- Disable SSH root password login (use keys); close MySQL port 53306 to the internet.
- `server_infos.md` holds root and DB passwords in plain text: change them and keep the file out of Git.

## Rollback
```
pm2 stop artrade-api
# restore the previous code from /root/artradeint_backup_<date>.tgz and the DB from /root/db_before_<date>.sql
```

## Updating later
Rebuild locally (`npm run build`), upload a new `artrade-release.tar.gz`, unpack over `/var/www/html/artradeint_mgt`, `cd server && npm ci --omit=dev && systemctl restart artrade-api`. Uploads and `.env` are never overwritten.
