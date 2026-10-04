import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Se evalúa al construir: /api/version la expone como «fecha de build».
  env: { BUILD_FECHA: new Date().toISOString() },
};

export default nextConfig;
