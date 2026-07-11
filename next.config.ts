import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/internal/schema": ["./supabase/schema_better_auth_001.sql", "./supabase/schema_001.sql"],
  },
};

export default nextConfig;
