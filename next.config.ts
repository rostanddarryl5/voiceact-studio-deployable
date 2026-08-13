import type { NextConfig } from "next";

const allowedDevOrigins = [
  "mobility-mournful-fester.ngrok-free.dev",
  "94b12017f175cc.lhr.life",
  "ee26ec3c4663dd.lhr.life",
  "0e54191d631566.lhr.life",
  ...(process.env.VOICEACT_ALLOWED_DEV_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  distDir: process.env.VOICEACT_NEXT_DIST_DIR || ".next",
  output: "standalone",
  allowedDevOrigins,
};

export default nextConfig;
