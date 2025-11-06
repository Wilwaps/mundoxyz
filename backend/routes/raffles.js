/**
 * Routes API - Sistema de Rifas Completo
 * Implementa todos los endpoints para rifas con modo empresas, premio, CAPTCHA, etc.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const RaffleService = require('../services/RaffleService');
const multer = require('multer');
const { query } = require('../db');

const raffleService = new RaffleService();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'));
        }
    }
});

/**
 * GET /api/raffles/public
 * Listar rifas públicas para el lobby con paginación
 */
router.get('/public', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const filters = {
            mode: req.query.mode,
            type: req.query.type,
            company_mode: req.query.company_mode === 'true' ? true : 
                         req.query.company_mode === 'false' ? false : undefined,
            search: req.query.search
        };

        const result = await raffleService.listPublicRaffles(page, limit, filters);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Error listing public raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/active
 * Obtener rifas activas del usuario actual
 */
router.get('/active', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffles = await raffleService.getUserActiveRaffles(userId);
        
        res.json({
            success: true,
            data: raffles
        });
    } catch (error) {
        console.error('Error getting active raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/participated
 * Obtener rifas en las que participó el usuario
 */
router.get('/participated', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffles = await raffleService.getUserParticipatedRaffles(userId);
        
        res.json({
            success: true,
            data: raffles
        });
    } catch (error) {
        console.error('Error getting participated raffles:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/create
 * Crear nueva rifa con todas las configuraciones
 */
router.post('/create', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const raffleData = req.body;

        // Validar datos requeridos
        if (!raffleData.name) {
            return res.status(400).json({
                success: false,
                error: 'El nombre de la rifa es requerido'
            });
        }

        // Aceptar fires, fire (legacy), y prize
        if (!raffleData.mode || !['fire', 'fires', 'prize'].includes(raffleData.mode)) {
            return res.status(400).json({
                success: false,
                error: 'Modo de rifa inválido. Modos permitidos: fires, prize'
            });
        }

        if (raffleData.is_company_mode && !raffleData.company_config) {
            return res.status(400).json({
                success: false,
                error: 'Configuración de empresa requerida para modo empresas'
            });
        }

        const raffle = await raffleService.createRaffle(userId, raffleData);
        
        res.json({
            success: true,
            data: raffle,
            message: 'Rifa creada exitosamente'
        });
    } catch (error) {
        console.error('Error creating raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code
 * Obtener detalles completos de una rifa por código
 */
router.get('/:code', async (req, res) => {
    try {
        const code = req.params.code;
        
        const raffle = await raffleService.getRaffleByCode(code);
        
        if (!raffle) {
            return res.status(404).json({
                success: false,
                error: 'Rifa no encontrada'
            });
        }
        
        res.json({
            success: true,
            data: raffle
        });
    } catch (error) {
        console.error('Error getting raffle details:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/purchase
 * Comprar números de rifa
 * 
 * Soporta dos modos:
 * - FUEGOS: compra directa sin CAPTCHA, descuento inmediato de wallet
 * - PREMIO: reserva con buyer_profile, requiere aprobación del host
 * 
 * Body para modo FUEGOS:
 * {
 *   raffle_id: UUID,
 *   numbers: number[],  // Array de índices
 *   mode: 'fires'
 * }
 * 
 * Body para modo PREMIO:
 * {
 *   raffle_id: UUID,
 *   numbers: number[],
 *   mode: 'prize',
 *   buyer_profile: {
 *     username: string,
 *     display_name: string,
 *     full_name: string,      // Obligatorio
 *     id_number: string,       // Obligatorio
 *     phone: string,           // Obligatorio
 *     location?: string
 *   },
 *   payment_method: 'transferencia' | 'efectivo',
 *   payment_reference?: string,  // Solo para transferencia
 *   message?: string
 * }
 */
router.post('/purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            raffle_id, 
            numbers, 
            mode, 
            buyer_profile, 
            payment_method, 
            payment_reference, 
            message 
        } = req.body;

        // Validaciones básicas
        if (!raffle_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de rifa requerido'
            });
        }

        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Debe seleccionar al menos un número'
            });
        }

        // Validar que los números sean integers válidos
        if (!numbers.every(n => Number.isInteger(n) && n >= 0)) {
            return res.status(400).json({
                success: false,
                error: 'Números inválidos'
            });
        }

        // Validaciones específicas por modo
        if (mode === 'prize') {
            // Modo premio requiere buyer_profile completo
            if (!buyer_profile) {
                return res.status(400).json({
                    success: false,
                    error: 'Perfil de comprador requerido para modo premio'
                });
            }

            const requiredFields = ['full_name', 'id_number', 'phone'];
            const missingFields = requiredFields.filter(field => !buyer_profile[field]);
            
            if (missingFields.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: `Campos requeridos faltantes: ${missingFields.join(', ')}`
                });
            }

            if (!payment_method || !['transferencia', 'efectivo'].includes(payment_method)) {
                return res.status(400).json({
                    success: false,
                    error: 'Método de pago inválido. Use "transferencia" o "efectivo"'
                });
            }
        }

        // Procesar compra (el service maneja la lógica por modo)
        const result = await raffleService.purchaseNumbers(userId, {
            raffleId: raffle_id,
            numbers,
            mode,
            buyerProfile: buyer_profile,
            paymentMethod: payment_method,
            paymentReference: payment_reference,
            message
        });
        
        res.json({
            success: true,
            data: result,
            message: mode === 'prize' 
                ? `Solicitud de compra enviada para ${numbers.length} número(s). Esperando aprobación del anfitrión.`
                : `¡Compra exitosa! ${numbers.length} número(s) adquirido(s).`
        });
    } catch (error) {
        console.error('Error en compra de números:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/captcha
 * Generar nuevo CAPTCHA matemático
 */
router.post('/captcha', (req, res) => {
    try {
        const captcha = raffleService.generateMathCaptcha();
        
        res.json({
            success: true,
            data: captcha
        });
    } catch (error) {
        console.error('Error generating captcha:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/approve-purchase
 * Aprobar solicitud de compra (modo premio) - Solo host
 */
router.post('/approve-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.approvePurchase(userId, request_id);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra aprobada exitosamente'
        });
    } catch (error) {
        console.error('Error approving purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/reject-purchase
 * Rechazar solicitud de compra - Solo host
 */
router.post('/reject-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id, reason } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.rejectPurchase(userId, request_id, reason);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra rechazada'
        });
    } catch (error) {
        console.error('Error rejecting purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-logo
 * Subir logo para modo empresa (almacena en PostgreSQL)
 */
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen'
            });
        }

        // Convertir imagen a Base64
        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        res.json({
            success: true,
            data: {
                logo_url: imageData,
                mime_type: req.file.mimetype
            },
            message: 'Logo procesado exitosamente'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-prize-image
 * Subir imagen del premio (almacena en PostgreSQL)
 */
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen del premio'
            });
        }

        // Convertir imagen a Base64
        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        res.json({
            success: true,
            data: {
                image_url: imageData,
                mime_type: req.file.mimetype
            },
            message: 'Imagen del premio procesada exitosamente'
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/numbers
 * Obtener grid completo de números de una rifa
 */
router.get('/:code/numbers', async (req, res) => {
    try {
        const code = req.params.code;
        
        const numbers = await raffleService.getRaffleNumbers(code);
        
        res.json({
            success: true,
            data: numbers
        });
    } catch (error) {
        console.error('Error getting raffle numbers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/:code/close
 * Cerrar rifa manualmente - Solo host
 */
router.post('/:code/close', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const code = req.params.code;

        const result = await raffleService.closeRaffleManually(userId, code);
        
        res.json({
            success: true,
            data: result,
            message: 'Rifa cerrada exitosamente'
        });
    } catch (error) {
        console.error('Error closing raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/ticket/:ticketNumber
 * Validar ticket digital con QR
 */
router.get('/:code/ticket/:ticketNumber', async (req, res) => {
    try {
        const code = req.params.code;
        const ticketNumber = req.params.ticketNumber;
        
        const ticket = await raffleService.validateTicket(code, ticketNumber);
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Ticket no encontrado o inválido'
            });
        }
        
        res.json({
            success: true,
            data: ticket
        });
    } catch (error) {
        console.error('Error validating ticket:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/stats/overview
 * Estadísticas generales del sistema de rifas
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await raffleService.getSystemStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/generate-pdf
 * Generar PDF de certificado para ganador con QR
 */
router.post('/generate-pdf', verifyToken, async (req, res) => {
    try {
        const { raffle_id } = req.body;
        
        if (!raffle_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de rifa requerido'
            });
        }

        const pdfUrl = await raffleService.generateWinnerPDF(raffle_id);
        
        res.json({
            success: true,
            data: { pdf_url: pdfUrl },
            message: 'PDF generado exitosamente'
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/reject-purchase
 * Rechazar solicitud de compra - Solo host
 */
router.post('/reject-purchase', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { request_id, reason } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de solicitud requerido'
            });
        }

        const result = await raffleService.rejectPurchase(userId, request_id, reason);
        
        res.json({
            success: true,
            data: result,
            message: 'Compra rechazada'
        });
    } catch (error) {
        console.error('Error rejecting purchase:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-logo
 * Subir logo para modo empresa (almacena en PostgreSQL)
 */
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen'
            });
        }

        // Convertir imagen a Base64
        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        res.json({
            success: true,
            data: {
                logo_url: imageData,
                mime_type: req.file.mimetype
            },
            message: 'Logo procesado exitosamente'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/upload-prize-image
 * Subir imagen del premio (almacena en PostgreSQL)
 */
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen del premio'
            });
        }

        // Convertir imagen a Base64
        const base64Image = req.file.buffer.toString('base64');
        const imageData = `data:${req.file.mimetype};base64,${base64Image}`;
        
        res.json({
            success: true,
            data: {
                image_url: imageData,
                mime_type: req.file.mimetype
            },
            message: 'Imagen del premio procesada exitosamente'
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/numbers
 * Obtener grid completo de números de una rifa
 */
router.get('/:code/numbers', async (req, res) => {
    try {
        const code = req.params.code;
        
        const numbers = await raffleService.getRaffleNumbers(code);
        
        res.json({
            success: true,
            data: numbers
        });
    } catch (error) {
        console.error('Error getting raffle numbers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/:code/close
 * Cerrar rifa manualmente - Solo host
 */
router.post('/:code/close', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const code = req.params.code;

        const result = await raffleService.closeRaffleManually(userId, code);
        
        res.json({
            success: true,
            data: result,
            message: 'Rifa cerrada exitosamente'
        });
    } catch (error) {
        console.error('Error closing raffle:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/:code/ticket/:ticketNumber
 * Validar ticket digital con QR
 */
router.get('/:code/ticket/:ticketNumber', async (req, res) => {
    try {
        const code = req.params.code;
        const ticketNumber = req.params.ticketNumber;
        
        const ticket = await raffleService.validateTicket(code, ticketNumber);
        
        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: 'Ticket no encontrado o inválido'
            });
        }
        
        res.json({
            success: true,
            data: ticket
        });
    } catch (error) {
        console.error('Error validating ticket:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/raffles/stats/overview
 * Estadísticas generales del sistema de rifas
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const stats = await raffleService.getSystemStats();
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/generate-pdf
 * Generar PDF de certificado para ganador con QR
 */
router.post('/generate-pdf', verifyToken, async (req, res) => {
    try {
        const { raffle_id } = req.body;
        
        if (!raffle_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de rifa requerido'
            });
        }

        const pdfUrl = await raffleService.generateWinnerPDF(raffle_id);
        
        res.json({
            success: true,
            data: { pdf_url: pdfUrl },
            message: 'PDF generado exitosamente'
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/raffles/:raffleId/payment-methods
 * Configurar métodos de cobro - Solo host de rifa modo premio
 */
router.post('/:raffleId/payment-methods', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { raffleId } = req.params;
        const { methods } = req.body;

        const result = await raffleService.setPaymentMethods(userId, raffleId, methods);
        res.json({ success: true, data: result, message: 'Métodos configurados' });
    } catch (error) {
        console.error('Error configurando métodos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/raffles/:raffleId/payment-methods
 * Obtener métodos de cobro configurados para una rifa
 */
router.get('/:raffleId/payment-methods', async (req, res) => {
    try {
        const { raffleId } = req.params;
        const methods = await raffleService.getPaymentMethods(raffleId);
        res.json({ success: true, data: methods });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/raffles/:raffleId/pending-requests
 * Obtener solicitudes de compra pendientes - Solo host
 */
router.get('/:raffleId/pending-requests', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { raffleId } = req.params;
        const requests = await raffleService.getPendingRequests(userId, raffleId);
        res.json({ success: true, data: requests });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/raffles/admin/cancel-raffle
 * Cancelar rifa con reembolso completo - Solo admin/tote
 */
router.post('/admin/cancel-raffle', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { raffle_id, reason } = req.body;

        const result = await raffleService.cancelRaffleWithRefund(userId, raffle_id, reason);
        res.json({ success: true, data: result, message: 'Rifa cancelada y reembolsada' });
    } catch (error) {
        console.error('Error cancelando rifa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/raffles/:id/payment-details
 * Actualizar datos de pago de una rifa (Premio/Empresa)
 * Solo el anfitrión puede actualizar
 */
router.put('/:id/payment-details', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const paymentData = req.body;

        const result = await raffleService.updatePaymentDetails(id, userId, paymentData);
        
        res.json({
            success: true,
            data: result,
            message: 'Datos de pago actualizados correctamente'
        });
    } catch (error) {
        console.error('Error actualizando datos de pago:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/raffles/:id/payment-details
 * Obtener datos de pago de una rifa
 * Público para rifas Premio/Empresa
 */
router.get('/:id/payment-details', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || null;

        const paymentDetails = await raffleService.getPaymentDetails(id, userId);
        
        if (!paymentDetails) {
            return res.json({
                success: true,
                data: null,
                message: 'Esta rifa no tiene datos de pago configurados'
            });
        }

        res.json({
            success: true,
            data: paymentDetails
        });
    } catch (error) {
        console.error('Error obteniendo datos de pago:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/raffles/:id/participants
 * Obtener lista pública de participantes
 * Solo muestra nombres públicos y números
 */
router.get('/:id/participants', async (req, res) => {
    try {
        const { id } = req.params;

        const participants = await raffleService.getParticipants(id);
        
        res.json({
            success: true,
            data: participants
        });
    } catch (error) {
        console.error('Error obteniendo participantes:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/raffles/:raffleId/participant/:requestId/full-data
 * Obtener datos completos de un participante
 * Solo accesible por Admin/Tote o Host (para ganador)
 */
router.get('/:raffleId/participant/:requestId/full-data', verifyToken, async (req, res) => {
    try {
        const { raffleId, requestId } = req.params;
        const userId = req.user.id;

        const fullData = await raffleService.getParticipantFullData(raffleId, requestId, userId);
        
        res.json({
            success: true,
            data: fullData
        });
    } catch (error) {
        console.error('Error obteniendo datos completos:', error);
        res.status(403).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/raffles/public/:code
 * Landing público para rifas modo Empresa
 * Sin autenticación requerida
 */
router.get('/public/:code', async (req, res) => {
    try {
        const { code } = req.params;

        // Buscar rifa por código
        const raffleResult = await query(`
            SELECT 
                r.id,
                r.code,
                r.name,
                r.description,
                r.mode,
                r.total_numbers,
                r.status,
                r.branding_logo_url,
                r.branding_colors,
                r.payment_cost_amount,
                r.payment_cost_currency,
                r.created_at
            FROM raffles r
            WHERE r.code = $1
        `, [code]);

        if (raffleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Rifa no encontrada'
            });
        }

        const raffle = raffleResult.rows[0];

        // Validar que sea modo empresa
        if (raffle.mode !== 'company') {
            return res.status(403).json({
                success: false,
                error: 'Esta rifa no tiene landing público'
            });
        }

        // Obtener números
        const numbersResult = await query(`
            SELECT number_idx, state, owner_id
            FROM raffle_numbers
            WHERE raffle_id = $1
            ORDER BY number_idx
        `, [raffle.id]);

        // Obtener participantes (nombres públicos)
        const participants = await raffleService.getParticipants(raffle.id);

        res.json({
            success: true,
            data: {
                raffle: {
                    id: raffle.id,
                    code: raffle.code,
                    name: raffle.name,
                    description: raffle.description,
                    total_numbers: raffle.total_numbers,
                    status: raffle.status,
                    branding_logo_url: raffle.branding_logo_url,
                    branding_colors: raffle.branding_colors,
                    payment_cost_amount: raffle.payment_cost_amount,
                    payment_cost_currency: raffle.payment_cost_currency,
                    created_at: raffle.created_at
                },
                numbers: numbersResult.rows.map(n => ({
                    number_idx: n.number_idx,
                    state: n.state,
                    is_available: n.state === 'available'
                })),
                participants
            }
        });
    } catch (error) {
        console.error('Error cargando landing público:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

module.exports = router;
