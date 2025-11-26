const express = require('express');
const router = express.Router();
const { query, transaction } = require('../../db');
const { verifyToken, optionalAuth } = require('../../middleware/auth');
const logger = require('../../utils/logger');

async function getStoreStaffRole(user, storeId) {
  if (!user || !storeId) return null;

  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes('tote') || roles.includes('admin')) {
    return 'global_admin';
  }

  const res = await query(
    `SELECT role FROM store_staff WHERE user_id = $1 AND store_id = $2 AND is_active = TRUE LIMIT 1`,
    [user.id, storeId]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0].role;
}

async function ensureGlobalInternalChannel(storeId, creatorUserId) {
  if (!storeId) return null;

  const existing = await query(
    `SELECT id FROM store_conversations
     WHERE store_id = $1 AND type = 'internal' AND channel_key = 'global'
     LIMIT 1`,
    [storeId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const insert = await query(
    `INSERT INTO store_conversations
       (store_id, type, channel_key, label, status, priority, created_by, metadata)
     VALUES ($1, 'internal', 'global', 'Chat general de tienda', 'open', 'normal', $2, '{}'::jsonb)
     RETURNING id`,
    [storeId, creatorUserId || null]
  );

  return insert.rows[0].id;
}

router.post('/:storeId/customer/messages', optionalAuth, async (req, res) => {
  try {
    const { storeId } = req.params;
    const user = req.user || null;
    const userId = user ? user.id : null;
    const rawMessage = (req.body && req.body.message) || '';
    const message = rawMessage.toString().trim();

    if (!userId) {
      return res.status(401).json({ error: 'Debes iniciar sesión para escribir a esta tienda.' });
    }

    if (!message) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    if (message.length > 2000) {
      return res
        .status(400)
        .json({ error: 'El mensaje es demasiado largo (máximo 2000 caracteres).' });
    }

    const storeResult = await query(
      `SELECT id, settings FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const storeRow = storeResult.rows[0];
    const settings = storeRow.settings || {};
    const messaging =
      settings.messaging && typeof settings.messaging === 'object' ? settings.messaging : {};
    const enabled = typeof messaging.enabled === 'boolean' ? messaging.enabled : true;

    if (!enabled) {
      return res.status(400).json({ error: 'Esta tienda tiene la mensajería desactivada.' });
    }

    const userInfoResult = await query(
      `SELECT display_name, username FROM users WHERE id = $1`,
      [userId]
    );

    const userInfo = userInfoResult.rows[0] || null;
    const customerLabelBase = userInfo?.display_name || userInfo?.username || 'Cliente';

    const conversation = await transaction(async (client) => {
      const existingConvRes = await client.query(
        `SELECT *
         FROM store_conversations
         WHERE store_id = $1
           AND type = 'customer'
           AND customer_id = $2
           AND status IN ('open', 'pending')
         ORDER BY last_message_at DESC
         LIMIT 1`,
        [storeId, userId]
      );

      let convRow;

      if (existingConvRes.rows.length > 0) {
        convRow = existingConvRes.rows[0];
      } else {
        const insertConvRes = await client.query(
          `INSERT INTO store_conversations
             (store_id, type, label, customer_id, status, priority, last_message_at, last_message_preview, metadata)
           VALUES ($1, 'customer', $2, $3, 'open', 'normal', NOW(), $4, '{}'::jsonb)
           RETURNING *`,
          [
            storeId,
            `Chat con ${customerLabelBase}`,
            userId,
            message.length > 200 ? `${message.slice(0, 197)}...` : message
          ]
        );
        convRow = insertConvRes.rows[0];
      }

      await client.query(
        `INSERT INTO store_conversation_messages
           (conversation_id, store_id, author_user_id, author_customer_id, author_type, message)
         VALUES ($1, $2, NULL, $3, 'customer', $4)`,
        [convRow.id, storeId, userId, message]
      );

      const preview = message.length > 200 ? `${message.slice(0, 197)}...` : message;

      await client.query(
        `UPDATE store_conversations
         SET last_message_at = NOW(),
             last_message_preview = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [convRow.id, preview]
      );

      await client.query(
        `INSERT INTO store_customers (store_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (store_id, user_id) DO NOTHING`,
        [storeId, userId]
      );

      return convRow;
    });

    if (req.io) {
      try {
        req.io.to(`store:${storeId}:staff`).emit('store:conversation:customer-message', {
          store_id: storeId,
          conversation_id: conversation.id,
          customer_id: userId,
          preview: conversation.last_message_preview,
          last_message_at: conversation.last_message_at
        });
      } catch (socketError) {
        logger.error('[StoreMessaging] Error emitting staff notification', {
          error: socketError.message,
          storeId,
          conversationId: conversation.id
        });
      }
    }

    res.json({
      conversation: {
        id: conversation.id,
        store_id: conversation.store_id,
        type: conversation.type,
        channel_key: conversation.channel_key,
        label: conversation.label,
        customer_id: conversation.customer_id,
        status: conversation.status,
        priority: conversation.priority,
        last_message_at: conversation.last_message_at,
        last_message_preview: conversation.last_message_preview,
        metadata: conversation.metadata,
        created_by: conversation.created_by,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at
      }
    });
  } catch (error) {
    logger.error('[StoreMessaging] Error creating customer message', {
      error: error.message
    });
    res.status(500).json({ error: 'Error al enviar mensaje a la tienda' });
  }
});

router.get('/:storeId/conversations', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const { type = 'customer', status = 'open', q } = req.query || {};

    const allowedTypes = ['customer', 'internal'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Tipo de conversación inválido' });
    }

    const staffRole = await getStoreStaffRole(req.user, storeId);
    if (!staffRole) {
      return res.status(403).json({ error: 'No autorizado para ver conversaciones de esta tienda' });
    }

    const params = [storeId, type];
    let where = 'sc.store_id = $1 AND sc.type = $2';

    if (status === 'open') {
      where += " AND sc.status IN ('open', 'pending')";
    } else if (status === 'closed') {
      where += " AND sc.status IN ('closed', 'archived')";
    }

    if (q && q.toString().trim() !== '') {
      params.push(`%${q.toString().trim()}%`);
      where += ` AND (sc.label ILIKE $${params.length} OR sc.last_message_preview ILIKE $${params.length})`;
    }

    if (type === 'internal') {
      await ensureGlobalInternalChannel(storeId, req.user.id);
    }

    const result = await query(
      `SELECT
         sc.id,
         sc.store_id,
         sc.type,
         sc.channel_key,
         sc.label,
         sc.customer_id,
         sc.status,
         sc.priority,
         sc.last_message_at,
         sc.last_message_preview,
         sc.metadata,
         sc.created_by,
         sc.created_at,
         sc.updated_at,
         cu.display_name AS customer_name,
         cu.ci_full AS customer_ci,
         cu.phone AS customer_phone
       FROM store_conversations sc
       LEFT JOIN users cu ON cu.id = sc.customer_id
       WHERE ${where}
       ORDER BY sc.last_message_at DESC NULLS LAST, sc.created_at DESC
       LIMIT 100`,
      params
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    logger.error('[StoreMessaging] Error listing conversations', {
      error: error.message
    });
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

router.get('/:storeId/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  try {
    const { storeId, conversationId } = req.params;
    const limitRaw = req.query && req.query.limit;
    const limit = Math.min(parseInt(limitRaw, 10) || 100, 500);

    const convRes = await query(
      `SELECT * FROM store_conversations WHERE id = $1 AND store_id = $2`,
      [conversationId, storeId]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const conv = convRes.rows[0];

    const staffRole = await getStoreStaffRole(req.user, storeId);
    const userId = req.user.id;
    const isCustomerOwner = conv.customer_id && conv.customer_id === userId;

    if (!staffRole && !isCustomerOwner) {
      return res.status(403).json({ error: 'No autorizado para ver esta conversación' });
    }

    const messagesRes = await query(
      `SELECT
         m.id,
         m.conversation_id,
         m.store_id,
         m.author_user_id,
         m.author_customer_id,
         m.author_type,
         m.message,
         m.metadata,
         m.created_at,
         su.display_name AS staff_name,
         su.username AS staff_username,
         cu.display_name AS customer_name,
         cu.username AS customer_username
       FROM store_conversation_messages m
       LEFT JOIN users su ON su.id = m.author_user_id
       LEFT JOIN users cu ON cu.id = m.author_customer_id
       WHERE m.conversation_id = $1 AND m.store_id = $2
       ORDER BY m.created_at ASC
       LIMIT $3`,
      [conversationId, storeId, limit]
    );

    res.json({ messages: messagesRes.rows });
  } catch (error) {
    logger.error('[StoreMessaging] Error fetching messages', {
      error: error.message
    });
    res.status(500).json({ error: 'Error al obtener mensajes de la conversación' });
  }
});

router.post('/:storeId/conversations/:conversationId/messages', verifyToken, async (req, res) => {
  try {
    const { storeId, conversationId } = req.params;
    const rawMessage = (req.body && req.body.message) || '';
    const message = rawMessage.toString().trim();

    if (!message) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    if (message.length > 2000) {
      return res
        .status(400)
        .json({ error: 'El mensaje es demasiado largo (máximo 2000 caracteres).' });
    }

    const convRes = await query(
      `SELECT * FROM store_conversations WHERE id = $1 AND store_id = $2`,
      [conversationId, storeId]
    );

    if (convRes.rows.length === 0) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    const conv = convRes.rows[0];
    const staffRole = await getStoreStaffRole(req.user, storeId);

    if (!staffRole) {
      return res.status(403).json({ error: 'No autorizado para responder en esta conversación' });
    }

    const userId = req.user.id;

    const insertedMessage = await transaction(async (client) => {
      const msgRes = await client.query(
        `INSERT INTO store_conversation_messages
           (conversation_id, store_id, author_user_id, author_customer_id, author_type, message)
         VALUES ($1, $2, $3, NULL, 'staff', $4)
         RETURNING *`,
        [conversationId, storeId, userId, message]
      );

      const msgRow = msgRes.rows[0];

      const preview = message.length > 200 ? `${message.slice(0, 197)}...` : message;

      await client.query(
        `UPDATE store_conversations
         SET last_message_at = NOW(),
             last_message_preview = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [conversationId, preview]
      );

      return msgRow;
    });

    if (req.io) {
      try {
        const payload = {
          id: insertedMessage.id,
          conversation_id: insertedMessage.conversation_id,
          store_id: insertedMessage.store_id,
          author_user_id: insertedMessage.author_user_id,
          author_type: insertedMessage.author_type,
          message: insertedMessage.message,
          created_at: insertedMessage.created_at
        };

        req.io.to(`store:${storeId}:conversation:${conversationId}`).emit(
          'store:conversation:staff-message',
          payload
        );

        if (conv.customer_id) {
          req.io.to(`user:${conv.customer_id}`).emit('store:conversation:staff-message', payload);
        }
      } catch (socketError) {
        logger.error('[StoreMessaging] Error emitting staff message', {
          error: socketError.message,
          storeId,
          conversationId
        });
      }
    }

    res.json({ message: insertedMessage });
  } catch (error) {
    logger.error('[StoreMessaging] Error sending staff message', {
      error: error.message
    });
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

router.post('/:storeId/internal-channels', verifyToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const rawLabel = (req.body && req.body.label) || '';
    const label = rawLabel.toString().trim();

    if (!label) {
      return res.status(400).json({ error: 'El nombre del hilo es obligatorio.' });
    }

    const staffRole = await getStoreStaffRole(req.user, storeId);

    const allowedRoles = ['owner', 'admin', 'manager', 'global_admin'];
    if (!staffRole || !allowedRoles.includes(staffRole)) {
      return res.status(403).json({ error: 'No autorizado para crear hilos internos' });
    }

    let channelKey = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')</json>
