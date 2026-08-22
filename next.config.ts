import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship SQL migrations with the server bundle so AUTO_MIGRATE can apply them on Vercel.
  outputFileTracingIncludes: { "/**": ["./supabase/migrations/**"] },
};

export default nextConfig;
