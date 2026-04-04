
const securityHeaders = [
  // Prevent clickjacking — nobody can embed iMYNTED in an iframe
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Force HTTPS for 1 year, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Stop referrer leaking to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable access to camera/mic/location by default
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + inline (Next.js requires unsafe-inline for hydration)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind requires unsafe-inline)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs + external brand/chart sources
      "img-src 'self' data: blob: https://cdn.brandfetch.io https://*.supabase.co",
      // Fonts: self
      "font-src 'self'",
      // Connect: self + Supabase + Finnhub + Alpaca + CoinGecko + CryptoPanic + RapidAPI
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://finnhub.io https://api.alpaca.markets https://paper-api.alpaca.markets https://stream.data.alpaca.markets https://api.coingecko.com https://cryptopanic.com https://*.rapidapi.com",
      // Frames: none
      "frame-src 'none'",
      // Workers: self + blob (for chart workers)
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
