import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Paws Playcare",
    short_name: "Paws Playcare",
    description: "Dog walking booking, walks & payments",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: "#1f8a70",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
