import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",        // static export for GitHub Pages
  trailingSlash: true,     // required for GitHub Pages routing
  images: { unoptimized: true },
};

export default nextConfig;
