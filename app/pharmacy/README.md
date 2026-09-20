# Pharmacy staff authentication

Pharmacy browser requests use the same-origin `/api/pharmacy` routes. Login is
`POST /api/pharmacy/auth/login`; identity is `GET /api/pharmacy/auth/me`; logout
is `POST /api/pharmacy/auth/logout`. Order/aggregator paths retain their backend
`/api/...` suffix beneath `/api/pharmacy`. Methods and actions are allowlisted.

The server consumes the backend login response and stores its unchanged opaque
session in `cil_pharmacy_session`: HttpOnly, Secure in production, SameSite=Lax,
Path=/, host-only, Max-Age=86400. Browser JavaScript never receives the token in
JSON or readable storage. Only the server forwards it as `staff_session` to the
backend. Backend `/api/auth/staff/me` is authoritative for staff identity and is
checked during login, page entry, identity requests, and proxied operations.
No SESSION_SECRET, decoding, signing, refresh, or third-party cookies are used.
Backend absolute expiry remains authoritative even while a local cookie exists.

`PHARMACY_API_URL` is server-only and defaults to the Pharmacy Render origin.
It must be an HTTPS origin (HTTP loopback is permitted outside production).
`CIL_PHARMACY_ORIGIN` is a server-configured exact HTTPS origin, defaulting to
https://cil-frontend.vercel.app. Configure it for a custom/preview deployment;
no wildcard origins are accepted. Development also permits the request's exact
HTTP localhost/loopback origin. Login/logout/mutations require matching Origin;
missing/null/foreign origins and cross-site Fetch Metadata are rejected. Host
and forwarded-host headers do not expand the production allowlist.

401 clears the Pharmacy cookie; client requests redirect to Pharmacy login.
409 refreshes the order without replaying a mutation. Outages preserve the
cookie and fail closed. Logout clears the local cookie without a backend call;
the backend's stateless token is not revoked and can remain valid until expiry.

The existing CIL application login/module-access checks remain in place for
operational pages. Pharmacy login itself is reachable without that CIL session;
Pharmacy staff authentication does not grant access to other CIL modules.

The old browser client referenced NEXT_PUBLIC_PHARMACY_SERVICE_KEY. This proxy
removes that reference and sends no service key, including for competitive
mutations. Existing backend service-key read compatibility is unchanged. If a
real key was previously bundled, an operator should separately remove the
public environment variable and rotate the exposed key. No credentials or
production configuration were inspected or changed here.
