import type { MetadataRoute } from "next";

import { publicConfig } from "@/lib/config";

const ROUTES = ["", "/how-it-works", "/privacy", "/faq", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${publicConfig.appUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}
