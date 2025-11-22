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

  // Nuevos componentes
  let titoGlobalRate = 0;
  let titoRate = 0;
  let leaderRate = 0;
  let potRate = 0;

  // Por ahora solo aplicamos la lógica Tito/Dividendo para comisiones 5% y 10%
  if (rate === 0.05 || rate === 0.10) {
    // Del 3% máximo asignado a Tito: 1.5% va siempre a dividendo global,
    // y hasta 1.5% va al Tito asociado (referido o propio).
    titoGlobalRate = 0.015;

    if (!hasLeader) {
      if (hasCommunityTito) {
        // Usuario con Tito (tito_owner_id) y sin líder:
        // 1.5% global + 1.5% al Tito dueño.
        titoRate = 0.015;
      } else if (hasTitoRole) {
        // Operaciones del propio Tito (sin tito_owner_id):
        // 1.5% global + 1.5% al mismo Tito.
        titoRate = 0.015;
      } else {
        // Sin Tito asociado: solo se genera el dividendo global (1.5%),
        // el otro 1.5% permanece en Tote.
        titoRate = 0;
      }
    } else {
      // Lógica de líder aún no implementada a nivel de datos;
      // dejamos leaderRate/potRate en 0 para no romper nada.
      titoRate = hasCommunityTito || hasTitoRole ? 0.015 : 0;
    }
  }

  const platformTotal = round4(base * rate);
  const titoGlobalTotal = round4(base * titoGlobalRate);
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

  // IMPORTANTE:
  // - platformTotal (5% o 10% de M) debe repartirse COMPLETO entre
  //   Tito directo, líder, pote y Tote.
  // - titoGlobalTotal es solo una vista contable (reserva dentro de la
  //   comisión de la plataforma para dividendo Tito), no se descuenta
  //   del monto que realmente recibe Tote en wallets.
  const allocated = titoTotal + leaderTotal + potTotal;
  const toteAmount = round4(platformTotal - allocated);

  return {
    platformCommissionTotal: platformTotal,
    titoUserId,
    titoCommissionAmount: titoTotal,
    titoBaseAmount,
    titoReferralAmount,
    titoGlobalAmount: titoGlobalTotal,
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
         tito_global_amount,
         leader_user_id,
         leader_commission_amount,
         community_pot_amount,
         tote_commission_amount,
         metadata
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
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
        split.titoGlobalAmount || null,
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
