# ORO Services

Public site for ORO Services, the parent of Emoro Building and Emporo Plumbing.

Home is the group overview. Each brand and each service has its own page. The enquiry form is at `/contact`. The privacy policy is at `/privacy`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Contact details on the site

Business phone numbers are not published.

| Team | Email |
| --- | --- |
| Emoro Building | info.emoro@orosvc.com |
| Emporo Plumbing | info.emporo@orosvc.com |
| ORO Services (parent / general) | info@orosvc.com |

The form sends an enquiry to the inbox that matches the brand. A photo is optional (JPEG, PNG, or WebP, up to 2 MB).

## Enquiry email (Gmail)

The form sends through Google Workspace SMTP (`smtp.gmail.com`) when both required variables are set on the Vercel project for Production and Preview. Do not commit them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GMAIL_USER` | Yes | Workspace address that signs in, for example `pat.z@orosvc.com`. This is the From address. |
| `GMAIL_APP_PASSWORD` | Yes | App password for that account. Spaces are ignored. |
| `MAIL_FROM_NAME` | No | Display name. Defaults to `ORO Services`. |

The message is delivered to the brand inbox (`info.emoro@`, `info.emporo@`, or `info@`). Reply-To is the person who filled in the form. A photo up to 2 MB is attached when they add one.

Gmail only sends as `GMAIL_USER` (or an alias already set up on that account). The brand addresses stay the recipients.

If either required variable is missing, or Gmail rejects the message, the form does not crash. It shows a `mailto:` link to the matching inbox with the enquiry filled in. A photo cannot be attached to that link. The person is told to attach it in their email app.

Turn on 2-Step Verification for the sending account, then create an App Password. A Workspace admin may need to allow app passwords first. Redeploy after saving the variables.

The form also uses a hidden honeypot field and a simple per-instance limit of 5 submissions in 10 minutes.

## Address suggestions

The suburb field can suggest Australian addresses. It stays a normal text input unless this variable is set at build time. Do not commit the key.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Browser key for Maps JavaScript API and Places API (New). |

The Maps script loads only after the person focuses the suburb field. A chosen place fills that same field with the formatted address. Results are limited to Australia and biased toward Melbourne and Victoria.

Use a browser key restricted to the HTTP referrers `https://www.orosvc.com/*` and `https://orosvc.com/*`, plus the Vercel preview host if previews should show suggestions. Restrict the key to Maps JavaScript API and Places API (New).

## Staff portal

The footer link Internal Login opens `/internal` on this site. After Google sign-in, Reports lists the job and safety forms. Stock dashboard is only a link to [tape.orosvc.com](https://tape.orosvc.com), which keeps its own sign-in.

`/internal` is not in the sitemap and is disallowed in `robots.txt`. The public pages and the enquiry form stay open without a session. There is still no middleware.

Sign-in is Google only. The allowlist is `INTERNAL_ALLOWED_EMAILS` (comma-separated). When that variable is blank, only `pat.z@orosvc.com` can sign in. Setting the variable replaces that default list, so `pat.z@orosvc.com` has to stay in the value or that account can no longer sign in. A rejected Google account is told it is not on the staff list. Failed attempts do not lock the account.

Drive filing uses an OAuth refresh token for `pat.z@orosvc.com` with the `drive.file` scope, so the app can only see files it creates. It creates `ORO Reports/<report type>/<year>/<date address>` and does not update or delete existing Drive files. The exact setup steps are in the pull request for this portal. `scripts/google-drive-consent.mjs` prints the one-time consent URL and the refresh token. Do not commit that token.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | Web OAuth client. Staff sign-in asks only for `openid email`. |
| `GOOGLE_CLIENT_SECRET` | Yes | Matching client secret. |
| `INTERNAL_SESSION_SECRET` | Yes | At least 16 characters. Signs the staff session cookie. |
| `INTERNAL_ALLOWED_EMAILS` | No | Comma-separated staff emails. A blank value starts as `pat.z@orosvc.com`. Any other value replaces that list, so keep `pat.z@orosvc.com` in it. |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Yes, to file reports | Offline token with scope `https://www.googleapis.com/auth/drive.file`. |
| `REPORT_NOTIFY_EMAIL` | No | Office copy. Defaults to `pat.z@orosvc.com`. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | No | Same mail path as the enquiry form. Reports still file when mail is unset. |

Redirect URI for staff sign-in: `https://www.orosvc.com/internal/auth/google/callback`. Local: `http://localhost:3000/internal/auth/google/callback`.

Do not commit the client secret, session secret, or refresh token.

## HTTP and the canonical host

`https://www.orosvc.com` is the canonical host. Redirects from `http://` and from the apex domain are done by Vercel in front of this app. There is no `vercel.json` redirect and no middleware for them. See the pull request notes if `http://` is answered by Cloudflare instead of Vercel.
