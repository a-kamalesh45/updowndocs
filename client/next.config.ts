import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    '192.168.1.10',
    '172.16.0.2',
  ],
};

export default nextConfig;
