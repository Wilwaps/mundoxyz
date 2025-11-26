import React from 'react';
import { useParams } from 'react-router-dom';
import ProtectedStoreRoute from './ProtectedStoreRoute';
import { getStoreIdFromSlugCached } from '../utils/storeHelpers';

const ProtectedStoreRouteBySlug = ({ 
  children, 
  requiredPermission = 'dashboard',
  fallbackPath = '/' 
}) => {
  const { slug } = useParams();
  
  if (!slug) {
    return <div>Store slug not found</div>;
  }

  return (
    <ProtectedStoreRoute 
      storeId={slug}
      storeSlug={slug}
      requiredPermission={requiredPermission}
      fallbackPath={fallbackPath}
    >
      {children}
    </ProtectedStoreRoute>
  );
};

export default ProtectedStoreRouteBySlug;
