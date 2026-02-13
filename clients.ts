export const clients = [
  {
    name: "columns",
    store: "columns-com.myshopify.com",
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN_COLUMNS,
  },
  {
    name: "bikedepot",
    store: "duq0xw-jh.myshopify.com",
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN_DEPOT,
  },
] as const;
