# Phase 5 — Authentication, RBAC & Admin Workspace

## Implemented

- Private sign-in at `/login`; public registration is disabled.
- Credentials are normalized and verified against bcrypt password hashes (cost 12).
- Signed HS256 session cookie: HttpOnly, SameSite=Strict, Secure in production, eight-hour expiry.
- Current user and active status are reloaded from PostgreSQL on protected requests; role claims in the cookie are not trusted for authorization.
- Dashboard route and analytics API require an authenticated active user.
- Admin-only account management at `/admin/users` and `/api/admin/users`.
- Admin can list users and create Admin or Researcher accounts. Passwords are hashed before storage; password hashes are never returned.
- Login, logout, initial admin creation, and user creation write audit events.
- Logout increments a database-backed session version and clears the cookie, revoking existing signed tokens for that account.
- Initial Admin is created through the local CLI; there is no public bootstrap endpoint.

## Local setup

1. Generate a unique secret (at least 32 random bytes) and store it as `AUTH_SECRET` in the ignored `.env` file. Do not commit it.
2. Create the first administrator:

   ```powershell
   npm.cmd run admin:create
   ```

3. Start the app and sign in at `/login`.

The old demo seed account has a random non-login password and is not a usable administrator account. Use the CLI to create a real account.

Run the integration verification while the local development server is running:

```powershell
npm.cmd run auth:check
```

## Role matrix

| Capability | Admin | Researcher |
|---|---:|---:|
| View authenticated dashboard | Yes | Yes |
| View analytics API | Yes | Yes |
| Open simulation lab | Yes | Yes |
| List workspace accounts | Yes | No |
| Create workspace accounts | Yes | No |

## Security boundaries and remaining work

- The in-memory login throttle is per application process and per normalized email; it is not a distributed rate limiter. Use an edge/WAF or shared rate-limit store before multi-instance production deployment.
- No password reset, MFA, invitation workflow, or account deactivation UI is implemented yet.
- Audit log retention and access review need a production policy.
- Review trusted proxy configuration and HTTPS before deployment.
- Simulation participant routes remain separate from staff authentication; consent remains mandatory before telemetry.
- Do not deploy publicly until Phase 6 security review, operational rate limiting, account recovery, and production configuration are complete.