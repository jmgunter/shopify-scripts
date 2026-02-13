import { ApiType, shopifyApiProject } from "@shopify/api-codegen-preset";

export default {
  schema: "https://shopify.dev/admin-graphql-direct-proxy/2025-10",
  documents: ["./scripts/**/*.{graphql,js,ts,jsx,tsx}"],
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion: "2025-10",
      documents: ["./admin-api/**/*.{graphql,js,ts,jsx,tsx}"],
      outputDir: "./types",
    }),
  },
};
