// Helper functions for store access control

import { useQuery } from '@tanstack/react-query';

// Fetch user's staff roles for a specific store
export const useStoreStaffRoles = (storeIdOrSlug) => {
  return useQuery({
    queryKey: ['storeStaff', storeIdOrSlug],
    queryFn: async () => {
      if (!storeIdOrSlug) return null;
      
      // Try to get store info first to determine if it's a slug or ID
      let storeId = storeIdOrSlug;
      
      // If it looks like a slug (contains letters), try to get the ID
      if (!storeIdOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        try {
          const response = await fetch(`/api/store/by-slug/${storeIdOrSlug}`);
          if (response.ok) {
            const data = await response.json();
            storeId = data.id;
          } else {
            return null; // Store not found
          }
        } catch {
          return null;
        }
      }
      
      const response = await fetch(`/api/store/${storeId}/staff/me`);
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          return null; // Not staff or store doesn't exist
        }
        throw new Error('Failed to fetch staff roles');
      }
      return response.json();
    },
    enabled: !!storeIdOrSlug,
    retry: false,
  });
};

// Check if user can access store dashboard
export const canAccessStoreDashboard = (staffData) => {
  if (!staffData) return false;
  const allowedRoles = ['owner', 'admin', 'manager'];
  return allowedRoles.includes(staffData.role);
};

// Check if user can access store POS
export const canAccessStorePOS = (staffData) => {
  if (!staffData) return false;
  const allowedRoles = ['owner', 'admin', 'manager', 'seller'];
  return allowedRoles.includes(staffData.role);
};

// Check if user can view store invoices
export const canViewStoreInvoices = (staffData) => {
  if (!staffData) return false;
  const allowedRoles = ['owner', 'admin', 'manager', 'seller'];
  return allowedRoles.includes(staffData.role);
};

// Check if user can access kitchen display
export const canAccessKitchenDisplay = (staffData) => {
  if (!staffData) return false;
  const allowedRoles = ['owner', 'admin', 'manager', 'mesonero', 'delivery'];
  return allowedRoles.includes(staffData.role);
};

// Get store slug from store ID
export const getStoreSlugFromId = async (storeId) => {
  if (!storeId) return null;
  try {
    const response = await fetch(`/api/store/${storeId}/info`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.slug;
  } catch {
    return null;
  }
};
