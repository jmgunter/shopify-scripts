/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type GetProductsWithMpnQueryVariables = AdminTypes.Exact<{
  cursor?: AdminTypes.InputMaybe<AdminTypes.Scalars['String']['input']>;
}>;


export type GetProductsWithMpnQuery = { products: { pageInfo: Pick<AdminTypes.PageInfo, 'hasNextPage' | 'endCursor'>, edges: Array<{ node: (
        Pick<AdminTypes.Product, 'id' | 'title' | 'legacyResourceId'>
        & { shopifyFactsMpn?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'id' | 'value'>>, customMpn?: AdminTypes.Maybe<Pick<AdminTypes.Metafield, 'id' | 'value'>> }
      ) }> } };

export type UpdateProductMetafieldMutationVariables = AdminTypes.Exact<{
  metafields: Array<AdminTypes.MetafieldsSetInput> | AdminTypes.MetafieldsSetInput;
}>;


export type UpdateProductMetafieldMutation = { metafieldsSet?: AdminTypes.Maybe<{ metafields?: AdminTypes.Maybe<Array<Pick<AdminTypes.Metafield, 'id' | 'namespace' | 'key' | 'value'>>>, userErrors: Array<Pick<AdminTypes.MetafieldsSetUserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n  query GetProductsWithMpn($cursor: String) {\n    products(first: 50, after: $cursor) {\n      pageInfo {\n        hasNextPage\n        endCursor\n      }\n      edges {\n        node {\n          id\n          title\n          legacyResourceId\n          shopifyFactsMpn: metafield(namespace: \"shopify--facts\", key: \"mpn\") {\n            id\n            value\n          }\n          customMpn: metafield(namespace: \"custom\", key: \"mpn\") {\n            id\n            value\n          }\n        }\n      }\n    }\n  }\n": {return: GetProductsWithMpnQuery, variables: GetProductsWithMpnQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n  mutation UpdateProductMetafield($metafields: [MetafieldsSetInput!]!) {\n    metafieldsSet(metafields: $metafields) {\n      metafields {\n        id\n        namespace\n        key\n        value\n      }\n      userErrors {\n        field\n        message\n      }\n    }\n  }\n": {return: UpdateProductMetafieldMutation, variables: UpdateProductMetafieldMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
