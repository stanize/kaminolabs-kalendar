import type { NextConfig } from "next";

const SUPABASE_URL = "https://rlxfcmijbesoblissmtd.supabase.co";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy Supabase auth through our own domain so Google OAuth consent
      // screen shows "kalendar.kaminolabs.dev" instead of the raw Supabase URL.
      {
        source: "/auth/v1/:path*",
        destination: `${SUPABASE_URL}/auth/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
