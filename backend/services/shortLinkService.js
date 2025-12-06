const { query } = require('../db');
const logger = require('../utils/logger');

function getBaseShortUrl() {
  const envBase = process.env.SHORT_LINK_BASE_URL || 'https://mxz.app';
  return envBase.replace(/\/$/, '');
}

function normalizeTargetUrl(targetUrl) {
  if (!targetUrl) return '';
  if (typeof targetUrl !== 'string') {
    targetUrl = String(targetUrl);
  }
  return targetUrl.trim();
}

function formatShortLinkRow(row) {
  const base = getBaseShortUrl();
  const code = row.code;
  return {
    code,
    short_url: `${base}/${code}`,
    target_url: row.target_url
  };
}

async function createOrGetShortLink({ targetUrl, createdBy = null, metadata = {} }) {
  const normalizedTarget = normalizeTargetUrl(targetUrl);

  if (!normalizedTarget) {
    throw new Error('targetUrl es requerido');
  }

  try {
    const createdByUuid = createdBy || null;

    const existingRes = await query(
      `SELECT code, target_url
       FROM short_links
       WHERE target_url = $1
         AND ((created_by IS NULL AND $2::uuid IS NULL) OR created_by = $2)
       ORDER BY id ASC
       LIMIT 1`,
      [normalizedTarget, createdByUuid]
    );

    if (existingRes.rows.length > 0) {
      return formatShortLinkRow(existingRes.rows[0]);
    }

    const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

    const insertRes = await query(
      `INSERT INTO short_links (target_url, created_by, metadata)
       VALUES ($1, $2, $3)
       RETURNING id, code, target_url`,
      [normalizedTarget, createdByUuid, JSON.stringify(safeMetadata)]
    );

    return formatShortLinkRow(insertRes.rows[0]);
  } catch (error) {
    logger.error('[ShortLinkService] Error creating short link', {
      error: error?.message,
      stack: error?.stack,
      targetUrl,
    });
    throw error;
  }
}

async function resolveShortCode(code) {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim();

  try {
    const res = await query(
      'SELECT target_url FROM short_links WHERE code = $1 LIMIT 1',
      [trimmed]
    );

    if (!res.rows.length) {
      return null;
    }

    return res.rows[0].target_url;
  } catch (error) {
    logger.error('[ShortLinkService] Error resolving short code', {
      error: error?.message,
      stack: error?.stack,
      code: trimmed
    });
    throw error;
  }
}

module.exports = {
  createOrGetShortLink,
  resolveShortCode,
};
