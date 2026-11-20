// Merchant API (v1) client on callApi (integration 'merchant') with the Google access token. Every function returns { ok, status, data, error } and never throws.
import { callApi } from './http.js';
import { accessToken, clearTokenCache } from './google.js';

const PRODUCTS = 'https://merchantapi.googleapis.com/products/v1';
const ACCOUNTS = 'https://merchantapi.googleapis.com/accounts/v1';
const enc = encodeURIComponent;
const dsName = (acc, ds) => `accounts/${acc}/dataSources/${ds}`;

/** Resource name of a product input. !! The "contentLanguage~feedLabel~offerId" format is from documentation memory: confirm it on the first
 *  real call (the API log shows any 4xx). The offerId part is percent-encoded. */
export const productInputName = (accountId, contentLanguage, feedLabel, offerId) => `accounts/${accountId}/productInputs/${enc(`${contentLanguage}~${feedLabel}~${offerId}`)}`;

async function api(action, url, method = 'GET', body) {
  let tok; try { tok = await accessToken(); } catch (e) { return { ok: false, status: 0, data: null, error: e.message }; }
  try {
    const r = await callApi({ integration: 'merchant', action, url, method, headers: { Authorization: 'Bearer ' + tok, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) clearTokenCache();
    return { ok: r.ok, status: r.status, data: r.data, error: r.ok ? '' : r.error };
  } catch (e) { return { ok: false, status: 0, data: null, error: String(e.message || e) }; }
}

export const insertProductInput = (accountId, dataSourceId, body) => api('insert_product', `${PRODUCTS}/accounts/${accountId}/productInputs:insert?dataSource=${enc(dsName(accountId, dataSourceId))}`, 'POST', body);
export const deleteProductInput = (accountId, dataSourceId, name) => api('delete_product', `${PRODUCTS}/${name}?dataSource=${enc(dsName(accountId, dataSourceId))}`, 'DELETE');
export const listProducts = (accountId, pageToken = '') => api('list_products', `${PRODUCTS}/accounts/${accountId}/products?pageSize=250${pageToken ? '&pageToken=' + enc(pageToken) : ''}`);
export const getAccount = accountId => api('get_account', `${ACCOUNTS}/accounts/${accountId}`);
export const registerGcp = (accountId, developerEmail) => api('register_gcp', `${ACCOUNTS}/accounts/${accountId}/developerRegistration:registerGcp`, 'POST', { developerEmail });
