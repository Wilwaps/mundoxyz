import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStoreStaffRoles } from '../utils/storePermissions';
import { getStoreIdFromSlugCached } from '../utils/storeHelpers';
import { canAccessKitchenDisplay } from '../utils/storePermissions';

const ProtectedStoreRoute = ({ 
  children, 
  storeId, 
  storeSlug,
  requiredPermission = 'dashboard', // 'dashboard', 'pos', 'invoices', 'kitchen'
  fallbackPath = '/' 
}) => {
  const location = useLocation();
  const { user } = useAuth();
  
  // If storeSlug is provided, get the store ID
  const actualStoreId = React.useMemo(() => {
    if (storeId && storeId !== storeSlug) return storeId;
    return storeSlug; // Will be resolved in the query
  }, [storeId, storeSlug]);
  
  const { data: staffData, isLoading, error } = useStoreStaffRoles(actualStoreId);

  // Show loading spinner while checking permissions
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="spinner"></div>
      </div>
    );
  }

  // If user is not logged in, redirect to login
  if (!user) {
    return (
      <Navigate 
        to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} 
        replace 
      />
    );
  }

  // If there's an error or user is not staff, redirect to store public page
  if (error || !staffData) {
    const redirectSlug = storeSlug || actualStoreId;
    return <Navigate to={`/store/${redirectSlug}`} replace />;
  }

  // Check specific permissions
  let hasPermission = false;
  
  switch (requiredPermission) {
    case 'dashboard':
      hasPermission = ['owner', 'admin', 'manager'].includes(staffData.role);
      break;
    case 'pos':
      hasPermission = ['owner', 'admin', 'manager', 'seller'].includes(staffData.role);
      break;
    case 'invoices':
      hasPermission = ['owner', 'admin', 'manager', 'seller'].includes(staffData.role);
      break;
    case 'kitchen':
      hasPermission = ['owner', 'admin', 'manager', 'mesonero', 'delivery'].includes(staffData.role);
      break;
    default:
      hasPermission = false;
  }

  if (!hasPermission) {
    // If user is staff but doesn't have permission, redirect to store public page
    const redirectSlug = storeSlug || actualStoreId;
    return <Navigate to={`/store/${redirectSlug}`} replace />;
  }

  // User has permission, render children
  return children;
};

export default ProtectedStoreRoute;
