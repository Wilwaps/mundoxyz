const { query } = require('../db');
const logger = require('../utils/logger');

function getExecutor(client) {
  if (client && typeof client.query === 'function') {
    return client;
  }
  return { query };
}

function round4(value) {
  const n = Number(value) || 0;
  return Math.round(n * 10000) / 10000;
}

async function getUserCommissionProfile(client, userId) {
  const executor = getExecutor(client);

  const res = await executor.query(
    `SELECT u.id,
            u.tito_owner_id,
            EXISTS (
              SELECT 1
              FROM user_roles ur
              JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id AND r.name = 'tito'
            ) AS is_tito
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );

  if (!res.rows.length) {
    return {
      userId,
      tito_owner_id: null,
      is_tito: false,
      leader_user_id: null
    };
  }

  const row = res.rows[0];
  return {
    userId: row.id,
    tito_owner_id: row.tito_owner_id || null,
    is_tito: !!row.is_tito,
    leader_user_id: null
  };
}

function computeCommissionSplit({ amountBase, platformRate, profile, leaderUserId }) {
  const base = Number(amountBase) || 0;
  const rate = Number(platformRate) || 0;
  const hasCommunityTito = !!profile.tito_owner_id;
  const hasTitoRole = !!profile.is_tito;
  const hasLeader = !!leaderUserId;

  let titoRate = 0;
  let leaderRate = 0;
  let potRate = 0;
  let toteRate = rate;

  if (rate === 0.05) {
    if (!hasLeader) {
      if (hasCommunityTito) {
        // Caso A: usuario con Tito (tito_owner_id) y sin líder
        titoRate = 0.03;
        toteRate = rate - titoRate; // 0.02
      } else if (hasTitoRole) {
        // Operaciones del propio Tito (mitad de su 3%)
        titoRate = 0.015;
        toteRate = rate - titoRate; // 0.035
      }
    } else {
      if (hasCommunityTito) {
        // Caso D: usuario con Tito y líder
        titoRate = 0.015;
        leaderRate = 0.015;
        potRate = 0.01;
        toteRate = rate - titoRate - leaderRate - potRate; // 0.01
      } else {
        // Caso C: usuario solo con líder (sin Tito)
        leaderRate = 0.03;
        potRate = 0.01;
        toteRate = rate - leaderRate - potRate; // 0.01
      }
    }
  } else if (rate === 0.10) {
    if (!hasLeader) {
      if (hasCommunityTito) {
        // 10% sin líder: 3% Tito, 7% Tote
        titoRate = 0.03;
        toteRate = rate - titoRate; // 0.07
      } else if (hasTitoRole) {
        // 10% operaciones del propio Tito: 1.5% Tito, 8.5% Tote
        titoRate = 0.015;
        toteRate = rate - titoRate; // 0.085
      }
    } else {
      if (hasCommunityTito) {
        // 10% con Tito y líder
        titoRate = 0.015;
        leaderRate = 0.015;
        potRate = 0.01;
        toteRate = rate - titoRate - leaderRate - potRate; // 0.06
      } else {
        // 10% solo líder
        leaderRate = 0.03;
        potRate = 0.01;
        toteRate = rate - leaderRate - potRate; // 0.06
      }
    }
  }

  const platformTotal = round4(base * rate);
  const titoTotal = round4(base * titoRate);
  const leaderTotal = round4(base * leaderRate);
  const potTotal = round4(base * potRate);

  let titoBaseAmount = 0;
  let titoReferralAmount = 0;
  let titoUserId = null;

  if (hasCommunityTito && titoTotal > 0) {
    titoReferralAmount = titoTotal;
    titoUserId = profile.tito_owner_id;
  } else if (!hasCommunityTito && hasTitoRole && titoTotal > 0) {
    titoBaseAmount = titoTotal;
    titoUserId = profile.userId;
  }

  const allocated = titoTotal + leaderTotal + potTotal;
  const toteAmount = round4(platformTotal - allocated);

  return {
    platformCommissionTotal: platformTotal,
    titoUserId,
    titoCommissionAmount: titoTotal,
    titoBaseAmount,
    titoReferralAmount,
    leaderUserId: hasLeader ? leaderUserId : null,
    leaderCommissionAmount: leaderTotal,
    communityPotAmount: potTotal,
    toteCommissionAmount: toteAmount
  };
}

async function logCommission(client, data) {
  const executor = getExecutor(client);
  const {
    operationId,
    operationType,
    actorUserId,
    amountBase,
    platformRate,
    split,
    metadata
  } = data;

  try {
    await executor.query(
      `INSERT INTO commissions_log (
         operation_id,
         operation_type,
         user_id,
         amount_base,
         platform_commission_rate,
         platform_commission_total,
         tito_user_id,
         tito_commission_amount,
         tito_base_amount,
         tito_referral_amount,
         leader_user_id,
         leader_commission_amount,
         community_pot_amount,
         tote_commission_amount,
         metadata
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
       )`,
      [
        operationId,
        operationType,
        actorUserId,
        amountBase,
        platformRate,
        split.platformCommissionTotal,
        split.titoUserId,
        split.titoCommissionAmount || null,
        split.titoBaseAmount || null,
        split.titoReferralAmount || null,
        split.leaderUserId,
        split.leaderCommissionAmount || null,
        split.communityPotAmount || null,
        split.toteCommissionAmount,
        metadata ? JSON.stringify(metadata) : '{}'
      ]
    );
  } catch (error) {
    logger.error('[CommissionService] Error logging commission', {
      error: error.message,
      operationId,
      operationType
    });
  }
}

async function calculateAndLogCommission({
  client,
  operationId,
  operationType,
  actorUserId,
  amountBase,
  platformCommissionRate,
  metadata
}) {
  const profile = await getUserCommissionProfile(client, actorUserId);
  const leaderUserId = profile.leader_user_id || null;

  const split = computeCommissionSplit({
    amountBase,
    platformRate: platformCommissionRate,
    profile,
    leaderUserId
  });

  await logCommission(client, {
    operationId,
    operationType,
    actorUserId,
    amountBase,
    platformRate: platformCommissionRate,
    split,
    metadata: metadata || null
  });

  return split;
}

module.exports = {
  calculateAndLogCommission
};
