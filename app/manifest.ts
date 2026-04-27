import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radar · رادار إيجارات الشرقية",
    short_name: "Radar",
    description:
      "رادار إيجارات الدمام والخبر — متابعة العروض النشطة وانخفاضات الأسعار.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4ecd8",
    theme_color: "#c8553d",
    lang: "ar",
    dir: "rtl",
    categories: ["lifestyle", "utilities", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
