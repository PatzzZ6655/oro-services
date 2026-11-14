import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const onVercel = process.env.VERCEL === "1";
// Preview deployments inject the Vercel Toolbar from vercel.live. The
// production deployment (www.orosvc.com) does not, so those origins are
// left out of the live policy. This is chosen at build time, not per
// request, so the CDN can keep serving one cached header set per deployment.
const allowVercelToolbar = process.env.VERCEL_ENV === "preview";

// Staff sign-in navigates to Google and back. Drive and email run on the server.
// No Google script, frame, or connect origin is added for the staff portal.
// Enforcing CSP without a per-request nonce. Next.js only applies nonces
// during dynamic rendering, which would turn off prerendering and the CDN
// cache this site uses. The inline scripts are Next.js flight data plus one
// first-party menu script. The inline styles are attributes (the hero
// gradient and next/image), which a nonce cannot allow. script-src-attr
// 'none' still blocks inline event handlers. Cross-Origin-Resource-Policy
// is intentionally unset so mail clients can keep hotlinking /email/*.gif.
function contentSecurityPolicy(): string {
  const scriptSrc = ["'self'", "'unsafe-inline'", "https://maps.googleapis.com", "https://maps.gstatic.com"];
  if (isDev) scriptSrc.push("'unsafe-eval'");
  if (allowVercelToolbar) scriptSrc.push("https://vercel.live");

  const styleSrc = ["'self'", "'unsafe-inline'", "https://maps.googleapis.com", "https://maps.gstatic.com"];
  if (allowVercelToolbar) styleSrc.push("https://vercel.live");

  const imgSrc = ["'self'", "blob:", "data:", "https://maps.googleapis.com", "https://maps.gstatic.com"];
  if (allowVercelToolbar) imgSrc.push("https://vercel.live", "https://vercel.com");

  const fontSrc = ["'self'"];
  if (allowVercelToolbar) fontSrc.push("https://vercel.live", "https://assets.vercel.com");

  const connectSrc = [
    "'self'",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://places.googleapis.com",
  ];
  if (allowVercelToolbar) connectSrc.push("https://vercel.live", "wss://ws-us3.pusher.com");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "script-src-attr 'none'",
    `style-src ${styleSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    `font-src ${fontSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${allowVercelToolbar ? "https://vercel.live" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // The staff portal is installable from /internal without a service worker.
    // worker-src stays 'none' so a worker cannot be registered. The manifest is
    // same-origin, so default-src 'self' already allows it. manifest-src is not set.
    "worker-src 'none'",
  ];

  if (onVercel) directives.push("upgrade-insecure-requests");

  return directives.join("; ");
}

const permissionsPolicy = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "encrypted-media=()",
  "fullscreen=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "midi=()",
  "payment=()",
  "picture-in-picture=()",
  "publickey-credentials-get=()",
  "screen-wake-lock=()",
  "usb=()",
  "xr-spatial-tracking=()",
  "browsing-topics=()",
].join(", ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Logos are shown around 48–128px. Keep the srcset inside that range
    // so the browser does not request a 2048px variant.
    deviceSizes: [384, 640],
    imageSizes: [48, 64, 96, 128, 192, 256],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Report PDFs read the Inter files and the brand logos from disk at runtime.
  outputFileTracingIncludes: {
    "/internal/**": ["./assets/fonts/**", "./public/logos/**"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: permissionsPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
