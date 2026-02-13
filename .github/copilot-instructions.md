This repo contains scripts that interact with the Shopify API. The scripts are written in TypeScript and use the Shopify API library for authentication and making API calls. The scripts are organized in the `admin-api` directory, and there is a GraphQL code generation configuration file `.graphqlrc.ts` that specifies how to generate TypeScript types from GraphQL queries. The `package.json` file includes scripts for running the migration script and generating GraphQL types. There is also an `.env` file that contains environment variables for the Shopify access token.

When creating a new script, use terminal prompts to ask which client the script will run for (clients.ts file list our client names and their shopify details).

Make new scripts fairly modular when possible. For instance if i ask you to create a script that updates a shopify product type from "Shirt" to "T-Shirt", you might create a function that has a setting for old product type and new product type, and then call that function with the appropriate arguments in the main script body. This way if we want to update other product types in the future we can easily reuse the function.

Make sure to always check shopify MCP before creating a script for up to date documentation.

When creating a script keep in mind shopify's API rate limits and try to batch requests when possible. For instance if you need to update multiple products, try to use the bulk operations API instead of making individual requests for each product.

When writing GraphQL queries, make sure to only request the fields that are necessary for the script to function. This will help reduce the amount of data being transferred and improve performance.

Some of these scripts may effect thousands of products so i want to make sure they have good logging and error handling. Make sure to log the progress of the script and any errors that occur so that we can easily identify and fix any issues.

Make sure each script/function has settings for batch size and delay between batches to help manage API rate limits. The batch size will determine how many items are processed in each batch, and the delay will help ensure that we don't exceed the API rate limits. The existing migrate-mpn-metafield.ts script is a good example of how to implement this.

When you answer me make sure to say you have read these instructions and understand them, to make sure i know you rea this.
