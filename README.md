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

## Internal login

A small footer link points at the internal dashboard: [stock-dashboard-oro-services.vercel.app](https://stock-dashboard-oro-services.vercel.app/). It uses `rel="noopener noreferrer nofollow"` and is not listed in the sitemap.

## HTTP and the canonical host

`https://www.orosvc.com` is the canonical host. Redirects from `http://` and from the apex domain are done by Vercel in front of this app. There is no `vercel.json` redirect and no middleware for them. See the pull request notes if `http://` is answered by Cloudflare instead of Vercel.
