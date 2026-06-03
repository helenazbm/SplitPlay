export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "SplitPlay",
  description: "Dividir a conta nunca foi tão simples e divertido",
  url: process.env.NEXT_PUBLIC_APP_URL,
  ogImage: "link-da-imagem",
  creator: "SplitPlay",
  keywords: [
    "dividir conta",
    "split bill",
    "restaurante",
    "rachar conta",
  ],
} as const;
