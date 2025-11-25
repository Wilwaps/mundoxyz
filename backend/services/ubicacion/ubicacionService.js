'use strict';

const { query } = require('../../db');
const logger = require('../../utils/logger');

function getClientQuery(client) {
  if (client && typeof client.query === 'function') {
    return client.query.bind(client);
  }
  return query;
}

function toNumber(value, fallback) {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : fallback;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

const DEFAULT_CONFIG = {
  enabled: false,
  mode: 'flat',
  flat_fee_usdt: 0,
  base_fee_usdt: 0,
  per_km_usdt: 0,
  max_fee_usdt: null,
  free_delivery_from_usdt: null,
  fallback_fee_usdt: 0,
  bands: []
};

function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const mode = source.mode === 'per_km' || source.mode === 'bands' ? source.mode : 'flat';
  const bandsRaw = Array.isArray(source.bands) ? source.bands : [];
  const bands = bandsRaw
    .map((b) => {
      if (!b || typeof b !== 'object') return null;
      const max_km = toNumberOrNull(b.max_km);
      const fee_usdt = toNumber(b.fee_usdt, 0);
      if (max_km === null) return null;
      return { max_km, fee_usdt };
    })
    .filter(Boolean)
    .sort((a, b) => a.max_km - b.max_km);

  return {
    enabled: source.enabled === true,
    mode,
    flat_fee_usdt: toNumber(source.flat_fee_usdt, DEFAULT_CONFIG.flat_fee_usdt),
    base_fee_usdt: toNumber(source.base_fee_usdt, DEFAULT_CONFIG.base_fee_usdt),
    per_km_usdt: toNumber(source.per_km_usdt, DEFAULT_CONFIG.per_km_usdt),
    max_fee_usdt: toNumberOrNull(source.max_fee_usdt),
    free_delivery_from_usdt: toNumberOrNull(source.free_delivery_from_usdt),
    fallback_fee_usdt: toNumber(source.fallback_fee_usdt, DEFAULT_CONFIG.fallback_fee_usdt),
    bands
  };
}

async function getStoreUbicacionContext(storeId, client) {
  const q = getClientQuery(client);
  try {
    const res = await q('SELECT settings, location FROM stores WHERE id = $1', [storeId]);
    if (res.rows.length === 0) {
      return {
        config: DEFAULT_CONFIG,
        storeLocation: null
      };
    }
    const row = res.rows[0];
    const settings = row.settings && typeof row.settings === 'object' ? row.settings : {};
    const ubicacionRaw = settings.ubicacion || null;
    const config = normalizeConfig(ubicacionRaw);

    const location = row.location && typeof row.location === 'object' ? row.location : null;
    let storeLocation = null;
    if (location) {
      const lat = toNumberOrNull(location.lat !== undefined ? location.lat : location.latitude);
      const lng = toNumberOrNull(location.lng !== undefined ? location.lng : location.longitude);
      if (lat !== null && lng !== null) {
        storeLocation = { lat, lng };
      }
    }

    return { config, storeLocation };
  } catch (error) {
    logger.error('Error fetching store ubicacion context', { storeId, error });
    return {
      config: DEFAULT_CONFIG,
      storeLocation: null
    };
  }
}

function getDeliveryCoords(deliveryInfo) {
  if (!deliveryInfo || typeof deliveryInfo !== 'object') return null;
  const coordsSource = deliveryInfo.coords || deliveryInfo.coordinates || null;
  if (!coordsSource || typeof coordsSource !== 'object') return null;
  const lat = toNumberOrNull(
    coordsSource.lat !== undefined ? coordsSource.lat : coordsSource.latitude
  );
  const lng = toNumberOrNull(
    coordsSource.lng !== undefined ? coordsSource.lng : coordsSource.longitude
  );
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function haversineKm(a, b) {
  const lat1 = toNumberOrNull(a && a.lat);
  const lon1 = toNumberOrNull(a && a.lng);
  const lat2 = toNumberOrNull(b && b.lat);
  const lon2 = toNumberOrNull(b && b.lng);
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aVal =
    sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(rLat1) * Math.cos(rLat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  const d = R * c;
  if (!Number.isFinite(d) || d < 0) return null;
  return d;
}

function applyPricingModel(config, distanceKm, subtotalUsdt) {
  const subtotal = toNumber(subtotalUsdt, 0);
  if (config.free_delivery_from_usdt !== null && subtotal >= config.free_delivery_from_usdt) {
    return 0;
  }

  if (!config.enabled) {
    return config.flat_fee_usdt;
  }

  let fee = 0;

  if (config.mode === 'per_km') {
    const perKm = config.per_km_usdt;
    const baseFee = config.base_fee_usdt;
    if (distanceKm === null) {
      fee = config.fallback_fee_usdt;
    } else {
      fee = baseFee + perKm * distanceKm;
    }
  } else if (config.mode === 'bands' && config.bands.length > 0) {
    if (distanceKm === null) {
      fee = config.fallback_fee_usdt;
    } else {
      const band = config.bands.find((b) => distanceKm <= b.max_km);
      fee = band ? band.fee_usdt : config.fallback_fee_usdt;
    }
  } else {
    fee = config.flat_fee_usdt;
  }

  if (config.max_fee_usdt !== null && fee > config.max_fee_usdt) {
    fee = config.max_fee_usdt;
  }
  if (!Number.isFinite(fee) || fee < 0) {
    return 0;
  }
  return fee;
}

async function calculateDeliveryFee(params, client) {
  if (!params || params.type !== 'delivery') {
    return 0;
  }
  const { storeId, subtotalUsdt, deliveryInfo } = params;
  const { config, storeLocation } = await getStoreUbicacionContext(storeId, client);
  const deliveryLocation = getDeliveryCoords(deliveryInfo);
  let distanceKm = null;
  if (storeLocation && deliveryLocation) {
    distanceKm = haversineKm(storeLocation, deliveryLocation);
  }
  const fee = applyPricingModel(config, distanceKm, subtotalUsdt);
  return fee;
}

module.exports = {
  calculateDeliveryFee,
  getStoreUbicacionContext,
  getDeliveryCoords,
  haversineKm
};
