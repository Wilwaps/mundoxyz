const { query, transaction } = require('../db');
const logger = require('../utils/logger');
const config = require('../config/config');

function getExecutor(client) {
  if (client && typeof client.query === 'function') {
    return client;
  }
  return { query };
}

function toNumber(value, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

async function getGlobalConfig(client) {
  const executor = getExecutor(client);
  try {
    const res = await executor.query('SELECT * FROM referral_config WHERE id = 1');
    if (!res.rows.length) {
      return {
        enabled: false,
        enable_withdrawals: false,
        enable_transfers: false,
        enable_bingo_rooms: false,
        enable_raffle_fire_rooms: false,
        enable_stores: false
      };
    }
    const row = res.rows[0];
    return {
      enabled: !!row.enabled,
      enable_withdrawals: !!row.enable_withdrawals,
      enable_transfers: !!row.enable_transfers,
      enable_bingo_rooms: !!row.enable_bingo_rooms,
      enable_raffle_fire_rooms: !!row.enable_raffle_fire_rooms,
      enable_stores: !!row.enable_stores
    };
  } catch (error) {
    logger.error('[ReferralService] Error loading global config', error);
    return {
      enabled: false,
      enable_withdrawals: false,
      enable_transfers: false,
      enable_bingo_rooms: false,
      enable_raffle_fire_rooms: false,
      enable_stores: false
    };
  }
}

async function getLevelsBySource(client, source) {
  const executor = getExecutor(client);
  const res = await executor.query(
    `SELECT level, percentage, active
     FROM referral_levels
     WHERE source = $1
     ORDER BY level ASC`,
    [source]
  );
  return res.rows;
}

async function getReferralChain(client, userId, maxLevels = 5) {
  const executor = getExecutor(client);
  const chain = [];
  const visited = new Set();
  let currentId = userId;

  while (chain.length < maxLevels && currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const res = await executor.query(
      `SELECT 
         u.id,
         u.referrer_id,
         r.id AS referrer_user_id,
         r.referrals_enabled AS referrer_enabled
       FROM users u
       LEFT JOIN users r ON r.id = u.referrer_id
       WHERE u.id = $1`,
      [currentId]
    );

    if (!res.rows.length) break;
    const row = res.rows[0];
    const referrerId = row.referrer_user_id;
    if (!referrerId) break;

    chain.push({
      level: chain.length + 1,
      userId: referrerId,
      referralsEnabled: row.referrer_enabled !== false
    });

    currentId = referrerId;
  }

  return chain;
}

async function distributeCommissions({
  client,
  source,
  actorUserId,
  baseAmount,
  currency,
  operationType,
  operationId,
  metadata
}) {
  const executor = getExecutor(client);
  const amount = toNumber(baseAmount, 0);
  if (!(amount > 0)) {
    return { success: false, reason: 'zero_amount' };
  }

  const cfg = await getGlobalConfig(executor);
  const sourceEnabledMap = {
    withdrawal: cfg.enable_withdrawals,
    transfer: cfg.enable_transfers,
    bingo_room: cfg.enable_bingo_rooms,
    raffle_fire_room: cfg.enable_raffle_fire_rooms,
    store: cfg.enable_stores
  };

  if (!cfg.enabled || !sourceEnabledMap[source]) {
    return { success: false, reason: 'disabled' };
  }

  const levels = await getLevelsBySource(executor, source);
  if (!levels.length) {
    return { success: false, reason: 'no_levels' };
  }

  const chain = await getReferralChain(executor, actorUserId, 5);
  if (!chain.length) {
    return { success: false, reason: 'no_chain' };
  }

  const results = [];

  for (const entry of chain) {
    const levelConfig = levels.find((l) => l.level === entry.level && l.active !== false);
    if (!levelConfig) continue;
    if (!entry.referralsEnabled) continue;

    const pct = toNumber(levelConfig.percentage, 0);
    if (!(pct > 0)) continue;

    const commissionAmount = (amount * pct) / 100;
    if (!(commissionAmount > 0)) continue;

    await executor.query(
      `INSERT INTO referral_commissions
       (referrer_id, referred_id, level, source, amount, currency, operation_type, operation_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entry.userId,
        actorUserId,
        entry.level,
        source,
        commissionAmount,
        currency,
        operationType,
        operationId || null,
        metadata ? JSON.stringify(metadata) : '{}'
      ]
    );

    results.push({
      level: entry.level,
      referrerId: entry.userId,
      amount: commissionAmount
    });
  }

  return {
    success: results.length > 0,
    totalLevels: results.length,
    results
  };
}

async function executeTap({ client, fromUserId, toUserId }) {
  const executor = getExecutor(client);

  if (!fromUserId || !toUserId) {
    throw new Error('fromUserId and toUserId are required');
  }
  if (fromUserId === toUserId) {
    throw new Error('No puedes hacer tap a ti mismo');
  }

  const relRes = await executor.query(
    `SELECT
       CASE 
         WHEN u.referrer_id = $2 THEN 'to_is_referrer'      -- toUser es referidor de fromUser
         WHEN r.referrer_id = $1 THEN 'from_is_referrer'    -- fromUser es referidor de toUser
         ELSE null
       END AS relation
     FROM users u
     LEFT JOIN users r ON r.id = $2
     WHERE u.id = $1`,
    [fromUserId, toUserId]
  );

  const relation = relRes.rows[0]?.relation || null;
  if (!relation) {
    throw new Error('Solo puedes hacer tap entre referidor y referido');
  }

  const lastTapRes = await executor.query(
    `SELECT created_at
     FROM referral_taps
     WHERE from_user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [fromUserId]
  );

  if (lastTapRes.rows.length) {
    const last = lastTapRes.rows[0].created_at;
    const now = new Date();
    const diffMs = now.getTime() - new Date(last).getTime();
    const hours = diffMs / (1000 * 60 * 60);
    if (hours < 24) {
      const nextAvailable = new Date(new Date(last).getTime() + 24 * 60 * 60 * 1000);
      return {
        success: false,
        cooldown: true,
        lastTapAt: last,
        nextAvailableAt: nextAvailable.toISOString()
      };
    }
  }

  const insertRes = await executor.query(
    `INSERT INTO referral_taps (from_user_id, to_user_id)
     VALUES ($1, $2)
     RETURNING id, created_at`,
    [fromUserId, toUserId]
  );

  const row = insertRes.rows[0];

  return {
    success: true,
    tapId: row.id,
    createdAt: row.created_at
  };
}

async function getMyReferralInfo(client, userId) {
  const executor = getExecutor(client);

  const meRes = await executor.query(
    `SELECT
       u.id,
       u.username,
       u.display_name,
       u.referrer_id,
       u.referrals_enabled,
       r.username AS referrer_username,
       r.display_name AS referrer_display_name
     FROM users u
     LEFT JOIN users r ON r.id = u.referrer_id
     WHERE u.id = $1`,
    [userId]
  );

  if (!meRes.rows.length) {
    return null;
  }

  const me = meRes.rows[0];

  const referralsRes = await executor.query(
    `SELECT id, username, display_name, created_at
     FROM users
     WHERE referrer_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );

  const commissionsRes = await executor.query(
    `SELECT currency, COALESCE(SUM(amount),0) AS total
     FROM referral_commissions
     WHERE referrer_id = $1
     GROUP BY currency`,
    [userId]
  );

  const tapsSent24Res = await executor.query(
    `SELECT COUNT(*)::bigint AS count
     FROM referral_taps
     WHERE from_user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
    [userId]
  );

  const tapsReceived24Res = await executor.query(
    `SELECT COUNT(*)::bigint AS count
     FROM referral_taps
     WHERE to_user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
    [userId]
  );

  const frontendBase = config.server.frontendUrl || '';
  const baseUrl = frontendBase.replace(/\/$/, '');
  const refCode = me.username;
  const referralLink = baseUrl ? `${baseUrl}/register?ref=${encodeURIComponent(refCode)}` : `/register?ref=${encodeURIComponent(refCode)}`;

  return {
    user: {
      id: me.id,
      username: me.username,
      display_name: me.display_name,
      referrals_enabled: me.referrals_enabled !== false
    },
    referrer: me.referrer_id
      ? {
          id: me.referrer_id,
          username: me.referrer_username,
          display_name: me.referrer_display_name
        }
      : null,
    referrals: referralsRes.rows,
    commissions: commissionsRes.rows,
    taps_last_24h: {
      sent: Number(tapsSent24Res.rows[0]?.count || 0),
      received: Number(tapsReceived24Res.rows[0]?.count || 0)
    },
    referral_link: referralLink
  };
}

async function getStats(client) {
  const executor = getExecutor(client);

  const tapsTotalRes = await executor.query(
    `SELECT COUNT(*)::bigint AS count FROM referral_taps`
  );
  const tapsDayRes = await executor.query(
    `SELECT COUNT(*)::bigint AS count FROM referral_taps WHERE created_at >= NOW() - INTERVAL '24 hours'`
  );
  const tapsWeekRes = await executor.query(
    `SELECT COUNT(*)::bigint AS count FROM referral_taps WHERE created_at >= NOW() - INTERVAL '7 days'`
  );
  const tapsMonthRes = await executor.query(
    `SELECT COUNT(*)::bigint AS count FROM referral_taps WHERE created_at >= NOW() - INTERVAL '30 days'`
  );

  const topReferrersByCountRes = await executor.query(
    `SELECT u.id, u.username, u.display_name, COUNT(*)::bigint AS total_referrals
     FROM users u
     JOIN users c ON c.referrer_id = u.id
     GROUP BY u.id, u.username, u.display_name
     ORDER BY total_referrals DESC
     LIMIT 10`
  );

  const topReferrersByCommissionRes = await executor.query(
    `SELECT u.id, u.username, u.display_name, COALESCE(SUM(rc.amount),0) AS total_commission
     FROM users u
     JOIN referral_commissions rc ON rc.referrer_id = u.id
     GROUP BY u.id, u.username, u.display_name
     ORDER BY total_commission DESC
     LIMIT 10`
  );

  return {
    taps: {
      total: Number(tapsTotalRes.rows[0]?.count || 0),
      last_24h: Number(tapsDayRes.rows[0]?.count || 0),
      last_7d: Number(tapsWeekRes.rows[0]?.count || 0),
      last_30d: Number(tapsMonthRes.rows[0]?.count || 0)
    },
    top_referrers_by_count: topReferrersByCountRes.rows,
    top_referrers_by_commission: topReferrersByCommissionRes.rows
  };
}

module.exports = {
  getGlobalConfig,
  getLevelsBySource,
  distributeCommissions,
  executeTap,
  getMyReferralInfo,
  getStats
};
