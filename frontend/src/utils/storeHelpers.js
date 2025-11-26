// Helper functions for store operations

// Get store ID from slug
export const getStoreIdFromSlug = async (slug) => {
  if (!slug) return null;
  try {
    const response = await fetch(`/api/store/by-slug/${slug}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.id;
  } catch {
    return null;
  }
};

// Store slug to ID cache for performance
const storeSlugToIdCache = new Map();

export const getStoreIdFromSlugCached = async (slug) => {
  if (!slug) return null;
  
  if (storeSlugToIdCache.has(slug)) {
    return storeSlugToIdCache.get(slug);
  }
  
  const storeId = await getStoreIdFromSlug(slug);
  if (storeId) {
    storeSlugToIdCache.set(slug, storeId);
  }
  
  return storeId;
};
