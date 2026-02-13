// scripts/migrate-mpn-metafield.ts
// This script migrates product MPN metafield from shopify--facts.mpn to custom.mpn

import "dotenv/config";
import { createAdminApiClient } from "@shopify/admin-api-client";
import type {
  GetProductsWithMpnQuery,
  UpdateProductMetafieldMutation,
} from "../types/admin.generated";

const SHOPIFY_STORE = "duq0xw-jh.myshopify.com";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_ACCESS_TOKEN) {
  console.error("SHOPIFY_ACCESS_TOKEN is not set in your .env");
  process.exit(1);
}

// Shopify API Rate Limit Configuration
// Ref: https://shopify.dev/docs/api/usage/rate-limits
const RATE_LIMIT_CONFIG = {
  // metafieldsSet can handle up to 25 metafields per mutation
  // Ref: https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet
  METAFIELDS_PER_MUTATION: 25,
  // Max concurrent requests - for batched metafield updates
  MAX_CONCURRENT_REQUESTS: 10,
  // Throttle threshold - slow down when available points drop below this
  THROTTLE_THRESHOLD: 100,
  // Minimum delay between batches (milliseconds)
  MIN_BATCH_DELAY: 500,
  // Maximum retry attempts for throttled requests
  MAX_RETRIES: 3,
  // Backoff multiplier for retries
  RETRY_BACKOFF: 2,
};

let currentThrottle = {
  available: 1000,
  restoreRate: 50,
  maximumAvailable: 1000,
};

// Create Admin API client
const client = createAdminApiClient({
  storeDomain: SHOPIFY_STORE,
  apiVersion: "2025-10",
  accessToken: SHOPIFY_ACCESS_TOKEN,
});

// GraphQL queries and mutations
const GET_PRODUCTS_WITH_MPN_QUERY = `#graphql
  query GetProductsWithMpn($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          legacyResourceId
          shopifyFactsMpn: metafield(namespace: "shopify--facts", key: "mpn") {
            id
            value
          }
          customMpn: metafield(namespace: "custom", key: "mpn") {
            id
            value
          }
        }
      }
    }
  }
`;

const UPDATE_METAFIELD_MUTATION = `#graphql
  mutation UpdateProductMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function graphqlRequest<T>(
  query: string,
  variables: Record<string, any> = {},
  retryCount = 0,
): Promise<T> {
  try {
    const response = await client.request(query, { variables });

    // Check for rate limit information in extensions
    if (response.extensions?.cost?.throttleStatus) {
      const throttleStatus = response.extensions.cost.throttleStatus;
      currentThrottle = {
        available: throttleStatus.currentlyAvailable || 1000,
        restoreRate: throttleStatus.restoreRate || 50,
        maximumAvailable: throttleStatus.maximumAvailable || 1000,
      };

      // Log warning if running low on available points
      if (currentThrottle.available < RATE_LIMIT_CONFIG.THROTTLE_THRESHOLD) {
        const waitTime = Math.ceil(
          (RATE_LIMIT_CONFIG.THROTTLE_THRESHOLD - currentThrottle.available) /
            currentThrottle.restoreRate,
        );
        console.warn(
          `⚠️  Rate limit low (${currentThrottle.available}/${currentThrottle.maximumAvailable} points). Waiting ${waitTime}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      }
    }

    if (!response.data) {
      throw new Error("No data returned from GraphQL");
    }

    return response.data as T;
  } catch (error: any) {
    // Check if it's a throttling error
    if (
      error?.message?.includes("Throttled") ||
      error?.message?.includes("rate limit")
    ) {
      if (retryCount < RATE_LIMIT_CONFIG.MAX_RETRIES) {
        const backoffTime =
          RATE_LIMIT_CONFIG.MIN_BATCH_DELAY *
          Math.pow(RATE_LIMIT_CONFIG.RETRY_BACKOFF, retryCount);
        console.warn(
          `⚠️  Rate limited. Retry ${retryCount + 1}/${
            RATE_LIMIT_CONFIG.MAX_RETRIES
          } in ${backoffTime}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return graphqlRequest<T>(query, variables, retryCount + 1);
      }
    }
    throw error;
  }
}

async function getAllProductsWithMpn(): Promise<
  Array<{
    id: string;
    title: string;
    shopifyFactsMpnValue: string;
    customMpnValue: string | null;
    needsUpdate: boolean;
  }>
> {
  const allProducts: Array<{
    id: string;
    title: string;
    shopifyFactsMpnValue: string;
    customMpnValue: string | null;
    needsUpdate: boolean;
  }> = [];

  let cursor: string | null = null;
  let hasNextPage = true;
  let pageCount = 0;

  console.log("Fetching all products...");

  while (hasNextPage) {
    pageCount++;
    const data: GetProductsWithMpnQuery =
      await graphqlRequest<GetProductsWithMpnQuery>(
        GET_PRODUCTS_WITH_MPN_QUERY,
        { cursor },
      );

    for (const edge of data.products.edges) {
      const node = edge.node;

      // Only process products that have the shopify--facts.mpn metafield
      if (node.shopifyFactsMpn?.value) {
        const shopifyFactsValue = node.shopifyFactsMpn.value;
        const customValue = node.customMpn?.value || null;

        // Check if update is needed (custom.mpn doesn't exist yet)
        // Only update if custom.mpn is empty to avoid redoing completed products
        const needsUpdate = customValue === null;

        allProducts.push({
          id: node.id,
          title: node.title,
          shopifyFactsMpnValue: shopifyFactsValue,
          customMpnValue: customValue,
          needsUpdate,
        });
      }
    }

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor ?? null;

    console.log(
      `  Page ${pageCount}: Found ${allProducts.length} products with shopify--facts.mpn`,
    );
  }

  console.log(`\nTotal products found: ${allProducts.length}`);
  return allProducts;
}

async function updateProductMetafieldsBatch(
  products: Array<{
    id: string;
    title: string;
    shopifyFactsMpnValue: string;
  }>,
): Promise<{ successCount: number; failedProducts: string[] }> {
  const metafieldsInput = products.map((product) => ({
    ownerId: product.id,
    namespace: "custom",
    key: "mpn",
    type: "single_line_text_field" as const,
    value: product.shopifyFactsMpnValue,
  }));

  const data = await graphqlRequest<UpdateProductMetafieldMutation>(
    UPDATE_METAFIELD_MUTATION,
    { metafields: metafieldsInput },
  );

  const userErrors = data.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    const failedProducts = userErrors.map((err) => {
      const productTitle =
        products.find((p) => err.field?.includes(p.id))?.title ||
        "Unknown product";
      return `${productTitle}: ${err.message}`;
    });

    // If there are errors, some may have succeeded
    const successCount = products.length - userErrors.length;
    return { successCount, failedProducts };
  }

  return { successCount: products.length, failedProducts: [] };
}

async function updateProductsBatch(
  products: Array<{
    id: string;
    title: string;
    shopifyFactsMpnValue: string;
  }>,
): Promise<{ successCount: number; failCount: number; errors: string[] }> {
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  // Process products in batches of 25 metafields per mutation
  const metafieldBatchSize = RATE_LIMIT_CONFIG.METAFIELDS_PER_MUTATION;
  const totalBatches = Math.ceil(products.length / metafieldBatchSize);

  for (let i = 0; i < products.length; i += metafieldBatchSize) {
    const batch = products.slice(i, i + metafieldBatchSize);
    const currentBatch = Math.floor(i / metafieldBatchSize) + 1;
    const batchStart = i + 1;
    const batchEnd = Math.min(i + metafieldBatchSize, products.length);

    console.log(
      `\nProcessing batch ${currentBatch}/${totalBatches} (products ${batchStart}-${batchEnd} of ${products.length})...`,
    );

    try {
      const result = await updateProductMetafieldsBatch(batch);
      successCount += result.successCount;

      if (result.failedProducts.length > 0) {
        failCount += result.failedProducts.length;
        errors.push(...result.failedProducts);
        console.log(
          `  ⚠️  ${result.failedProducts.length} failures in this batch`,
        );
      }

      console.log(
        `  ✓ Batch complete: ${result.successCount} successful${
          result.failedProducts.length > 0
            ? `, ${result.failedProducts.length} failed`
            : ""
        }`,
      );
    } catch (error: any) {
      // If entire batch fails, count all as failures
      failCount += batch.length;
      const errorMsg = error?.message || "Unknown error";
      errors.push(`Batch ${currentBatch} failed: ${errorMsg}`);
      console.error(`  ❌ Batch ${currentBatch} failed:`, errorMsg);
    }

    console.log(
      `  Rate limit: ${currentThrottle.available}/${currentThrottle.maximumAvailable} points available`,
    );

    // Add adaptive delay between batches based on available rate limit
    if (i + metafieldBatchSize < products.length) {
      let delay = RATE_LIMIT_CONFIG.MIN_BATCH_DELAY;

      // If rate limit is low, add extra delay to let it restore
      if (currentThrottle.available < RATE_LIMIT_CONFIG.THROTTLE_THRESHOLD) {
        const extraDelay = Math.ceil(
          ((RATE_LIMIT_CONFIG.THROTTLE_THRESHOLD - currentThrottle.available) /
            currentThrottle.restoreRate) *
            1000,
        );
        delay = Math.max(delay, extraDelay);
        console.log(`  ⏳ Adding ${delay}ms delay to restore rate limit...`);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { successCount, failCount, errors };
}

async function main() {
  console.log("Starting MPN metafield migration script...\n");
  console.log("This will copy values from shopify--facts.mpn to custom.mpn\n");

  // Get all products with shopify--facts.mpn metafield
  const allProducts = await getAllProductsWithMpn();

  if (allProducts.length === 0) {
    console.log(
      "No products found with shopify--facts.mpn metafield. Exiting.",
    );
    return;
  }

  // Filter products that need updates
  const productsToUpdate = allProducts.filter((p) => p.needsUpdate);

  console.log(`\n=== ANALYSIS ===`);
  console.log(`Total products with shopify--facts.mpn: ${allProducts.length}`);
  console.log(`Products needing migration: ${productsToUpdate.length}`);
  console.log(
    `Products already migrated: ${allProducts.length - productsToUpdate.length}`,
  );

  if (productsToUpdate.length === 0) {
    console.log("\nAll products already have custom.mpn populated. Exiting.");
    return;
  }

  // Show summary
  console.log("\n=== UPDATE SUMMARY ===");
  console.log(`Total products to migrate: ${productsToUpdate.length}`);
  console.log("\nThe following products will have custom.mpn populated:");
  productsToUpdate.slice(0, 30).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.title} - MPN: ${p.shopifyFactsMpnValue}`);
  });
  if (productsToUpdate.length > 30) {
    console.log(`  ... and ${productsToUpdate.length - 30} more`);
  }

  console.log("\n⚠️  Starting update in 8 seconds... Press Ctrl+C to cancel\n");

  // Countdown with ability to cancel
  for (let i = 8; i > 0; i--) {
    process.stdout.write(`\rStarting in ${i} second${i > 1 ? "s" : ""}...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log("\n\n🚀 Starting update process...\n");

  // Update products in batches
  const estimatedRequests = Math.ceil(
    productsToUpdate.length / RATE_LIMIT_CONFIG.METAFIELDS_PER_MUTATION,
  );
  console.log(
    `Processing ${productsToUpdate.length} products in ~${estimatedRequests} API requests (${RATE_LIMIT_CONFIG.METAFIELDS_PER_MUTATION} products per request)...`,
  );
  console.log(
    `Rate limit config: Max ${currentThrottle.maximumAvailable} points, restores at ${currentThrottle.restoreRate} points/sec\n`,
  );

  const result = await updateProductsBatch(productsToUpdate);

  console.log("\n=== MIGRATION SUMMARY ===");
  console.log(`Total products processed: ${productsToUpdate.length}`);
  console.log(`Successfully migrated: ${result.successCount}`);
  console.log(`Failed: ${result.failCount}`);
  console.log(
    `Already migrated: ${allProducts.length - productsToUpdate.length}`,
  );

  if (result.errors.length > 0) {
    console.log("\n=== ERRORS ===");
    result.errors.forEach((error) => console.log(`  ${error}`));
  }

  console.log("\n✅ Migration complete!");
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
