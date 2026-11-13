import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Produit un serveur Node minimal pour Docker
  output: "standalone",
};

export default nextConfig;