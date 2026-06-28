import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Origens permitidas pra acessar o dev server de outros devices na LAN
  // (necessário pro celular conseguir baixar os chunks JS — sem isso o React
  // não hidrata e os formulários caem no submit default).
  allowedDevOrigins: ["192.168.0.7", "192.168.0.9"],
};

export default nextConfig;
