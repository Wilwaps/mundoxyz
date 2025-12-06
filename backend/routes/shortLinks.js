const express = require('express');
const router = express.Router();

const logger = require('../utils/logger');
const { optionalAuth } = require('../middleware/auth');
const { createOrGetShortLink } = require('../services/shortLinkService');

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { target_url, metadata } = req.body || {};

    if (!target_url || typeof target_url !== 'string') {
      return res.status(400).json({ error: 'target_url es requerido y debe ser un string' });
    }

    const createdBy = req.user ? req.user.id : null;

    const result = await createOrGetShortLink({
      targetUrl: target_url,
      createdBy,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });

    return res.json(result);
  } catch (error) {
    logger.error('[ShortLinks] Error creando short link', {
      error: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ error: 'Error al crear short link' });
  }
});

module.exports = router;
