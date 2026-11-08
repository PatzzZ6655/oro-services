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

## Enquiry email (Resend)

Set both variables on the Vercel project for Production and Preview. Do not commit them.

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | API key from [Resend](https://resend.com) |
| `RESEND_FROM_EMAIL` | Verified sender on the `orosvc.com` domain, for example `ORO Services <enquiries@orosvc.com>` |

Verify the `orosvc.com` domain in Resend before sending. The From address has to be on that domain. `reply_to` is the person who filled in the form, so a reply goes back to them.

If either variable is missing, or Resend rejects the message, the form does not crash. It shows a `mailto:` link to the matching inbox with the enquiry filled in. A photo cannot be attached to that link. The person is told to attach it in their email app.

The form also uses a hidden honeypot field and a simple per-instance limit of 5 submissions in 10 minutes.

## Internal login

A small footer link points at the internal dashboard: [stock-dashboard-oro-services.vercel.app](https://stock-dashboard-oro-services.vercel.app/). It uses `rel="noopener noreferrer nofollow"` and is not listed in the sitemap.

## HTTP and the canonical host

`https://www.orosvc.com` is the canonical host. Redirects from `http://` and from the apex domain are done by Vercel in front of this app. There is no `vercel.json` redirect and no middleware for them. See the pull request notes if `http://` is answered by Cloudflare instead of Vercel.
