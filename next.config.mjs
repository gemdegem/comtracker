/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    BITQUERY_API_KEY: process.env.BITQUERY_API_KEY,
  },
};

export default nextConfig;
 