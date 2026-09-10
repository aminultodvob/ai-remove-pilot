import type { MetadataRoute } from "next";

import { publicConfig } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The processing endpoint is not a page and has nothing to index.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${publicConfig.appUrl}/sitemap.xml`,
  };
}
