// Use the Shopify AJAX API to fetch all products in a store: https://shopify.dev/docs/api/ajax
function getAllProducts(page = 1, products = []) {
  return fetch(
    `${window.Shopify.routes.root}recommendations/products.json?limit=250&page=${page}`
  )
    .then((response) => response.json())
    .then((data) => {
      products = products.concat(data.products);

      if (data.products.length === 250) {
        // If the maximum number of products was returned, there might be more to fetch
        return fetchProducts(page + 1, products);
      }

      return products;
    });
}

getAllProducts()
  .then((allProducts) => {
    // Handle the full list of products
    console.log(allProducts);
    // You can now process and display these products as needed
  })
  .catch((error) => {
    console.error("Error fetching products:", error);
  });
