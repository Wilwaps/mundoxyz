/**
 * Sistema de Rifas V2 - Validadores
 * Esquemas de validación con Joi
 */

const Joi = require('joi');
const {
  RaffleStatus,
  RaffleMode,
  RaffleVisibility,
  PaymentMethod,
  SystemLimits
} = require('../types');

// Esquema para crear rifa
const createRaffleSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(SystemLimits.MAX_NAME_LENGTH)
    .required()
    .messages({
      'string.min': 'El nombre debe tener al menos 3 caracteres',
      'string.max': `El nombre no puede exceder ${SystemLimits.MAX_NAME_LENGTH} caracteres`,
      'any.required': 'El nombre es requerido'
    }),
    
  description: Joi.string()
    .max(SystemLimits.MAX_DESCRIPTION_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `La descripción no puede exceder ${SystemLimits.MAX_DESCRIPTION_LENGTH} caracteres`
    }),
    
  mode: Joi.string()
    .valid(...Object.values(RaffleMode))
    .required()
    .messages({
      'any.only': 'Modo de rifa inválido',
      'any.required': 'El modo es requerido'
    }),
    
  visibility: Joi.string()
    .valid(...Object.values(RaffleVisibility))
    .default(RaffleVisibility.PUBLIC)
    .messages({
      'any.only': 'Visibilidad inválida'
    }),
    
  numbersRange: Joi.when('visibility', {
    is: RaffleVisibility.COMPANY,
    then: Joi.number()
      .integer()
      .min(SystemLimits.MIN_NUMBERS)
      .max(SystemLimits.MAX_NUMBERS_COMPANY),
    otherwise: Joi.number()
      .integer()
      .min(SystemLimits.MIN_NUMBERS)
      .max(SystemLimits.MAX_NUMBERS_NORMAL)
  })
    .default(SystemLimits.DEFAULT_NUMBERS)
    .messages({
      'number.min': `Mínimo ${SystemLimits.MIN_NUMBERS} números`,
      'number.max': `Cantidad de números fuera de los límites permitidos`
    }),
    
  entryPrice: Joi.number()
    .positive()
    .when('mode', {
      is: RaffleMode.FIRES,
      then: Joi.number()
        .min(SystemLimits.MIN_PRICE_FIRES)
        .max(SystemLimits.MAX_PRICE_FIRES),
      otherwise: Joi.when('mode', {
        is: RaffleMode.COINS,
        then: Joi.number()
          .min(SystemLimits.MIN_PRICE_COINS)
          .max(SystemLimits.MAX_PRICE_COINS),
        otherwise: Joi.when('mode', {
          is: RaffleMode.PRIZE,
          then: Joi.number().optional(),
          otherwise: Joi.forbidden()
        })
      })
    })
    .messages({
      'number.positive': 'El precio debe ser positivo',
      'number.min': 'Precio por debajo del mínimo permitido',
      'number.max': 'Precio excede el máximo permitido'
    }),
    
  startsAt: Joi.date()
    .iso()
    .min('now')
    .optional()
    .messages({
      'date.min': 'La fecha de inicio debe ser futura'
    }),
    
  endsAt: Joi.date()
    .iso()
    .greater(Joi.ref('startsAt'))
    .optional()
    .messages({
      'date.greater': 'La fecha de fin debe ser posterior al inicio'
    }),
    
  termsConditions: Joi.string()
    .max(2000)
    .optional()
    .allow(''),
    
  prizeMeta: Joi.when('mode', {
    is: RaffleMode.PRIZE,
    then: Joi.object({
      prizeType: Joi.string().valid('product', 'service', 'experience').default('product'),
      prizeDescription: Joi.string().required().messages({
        'any.required': 'La descripción del premio es requerida'
      }),
      prizeValue: Joi.number().positive().optional(),
      prizeImages: Joi.array().items(Joi.string().uri()).optional(),
      isPromotion: Joi.boolean().optional().default(false),
      winnersCount: Joi.number().integer().min(1).optional(),
      bankingInfo: Joi.object({
        accountHolder: Joi.string().optional(),
        bankCode: Joi.string().optional(),
        bankName: Joi.string().optional(),
        accountNumber: Joi.string().optional(),
        accountType: Joi.string().valid('ahorro', 'corriente').optional(),
        idNumber: Joi.string().optional(),
        phone: Joi.string().optional()
      }).optional()
    }).required(),
    otherwise: Joi.object().optional()
  }),
  
  companyConfig: Joi.when('visibility', {
    is: RaffleVisibility.COMPANY,
    then: Joi.object({
      companyName: Joi.string().required(),
      rifNumber: Joi.string().required(),
      primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
      secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
      logoUrl: Joi.string().uri().optional(),
      logoBase64: Joi.string().optional(),
      contactEmail: Joi.string().email().optional(),
      contactPhone: Joi.string().optional()
    }).required(),
    otherwise: Joi.optional()
  }),
  
  allowFiresPayment: Joi.boolean().optional(),
  
  // Imagen del premio en base64 (puede venir como data URL o solo el payload)
  prizeImageBase64: Joi.string().optional(),
  
  // Modo de sorteo
  drawMode: Joi.string()
    .valid('automatic', 'scheduled', 'manual')
    .default('automatic'),
  
  // Fecha programada de sorteo (solo si drawMode = scheduled, se valida en capa de negocio)
  scheduledDrawAt: Joi.date()
    .iso()
    .optional()
});

// Esquema para actualizar rifa
const updateRaffleSchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(SystemLimits.MAX_NAME_LENGTH)
    .optional(),
    
  description: Joi.string()
    .max(SystemLimits.MAX_DESCRIPTION_LENGTH)
    .optional()
    .allow(''),
    
  visibility: Joi.string()
    .valid(...Object.values(RaffleVisibility))
    .optional(),
    
  startsAt: Joi.date()
    .iso()
    .optional(),
    
  endsAt: Joi.date()
    .iso()
    .optional(),
    
  termsConditions: Joi.string()
    .max(2000)
    .optional()
    .allow(''),
    
  prizeMeta: Joi.object({
    // Campos modernos de PrizeMeta
    prizeType: Joi.string().valid('product', 'service', 'experience').optional(),
    prizeDescription: Joi.string().optional(),
    prizeValue: Joi.number().positive().optional(),
    prizeImages: Joi.array().items(Joi.string().uri()).optional(),
    category: Joi.string().optional(),

    isPromotion: Joi.boolean().optional(),

    winnersCount: Joi.number().integer().min(1).optional(),

    bankingInfo: Joi.object({
      accountHolder: Joi.string().optional(),
      bankCode: Joi.string().optional(),
      bankName: Joi.string().optional(),
      accountNumber: Joi.string().optional(),
      accountType: Joi.string().valid('ahorro', 'corriente').optional(),
      idNumber: Joi.string().optional(),
      phone: Joi.string().optional()
    }).optional(),

    // Campos legacy mantenidos por compatibilidad
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    imageUrl: Joi.string().uri().optional(),
    estimatedValue: Joi.number().positive().optional()
  }).optional(),
  
  companyConfig: Joi.object({
    companyName: Joi.string().optional(),
    rifNumber: Joi.string().optional(),
    primaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
    secondaryColor: Joi.string().pattern(/^#[0-9A-F]{6}$/i).optional(),
    logoUrl: Joi.string().uri().optional(),
    logoBase64: Joi.string().optional(),
    contactEmail: Joi.string().email().optional(),
    contactPhone: Joi.string().optional()
  }).optional()
}).min(1); // Al menos un campo debe ser actualizado

// Esquema para comprar número
const purchaseNumberSchema = Joi.object({
  paymentMethod: Joi.string()
    .valid(...Object.values(PaymentMethod))
    .required()
    .messages({
      'any.only': 'Método de pago inválido',
      'any.required': 'El método de pago es requerido'
    }),
    
  paymentReference: Joi.when('paymentMethod', {
    is: Joi.string().valid(PaymentMethod.MOBILE, PaymentMethod.BANK),
    then: Joi.string()
      .pattern(/^[A-Z0-9]{6,20}$/)
      .required()
      .messages({
        'string.pattern.base': 'Referencia de pago inválida',
        'any.required': 'La referencia es requerida para este método de pago'
      }),
    otherwise: Joi.optional()
  }),
  
  buyerName: Joi.when('paymentMethod', {
    is: PaymentMethod.CASH,
    then: Joi.string().required(),
    otherwise: Joi.optional()
  }),
  
  buyerEmail: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Email inválido'
    }),
    
  buyerPhone: Joi.string()
    .pattern(/^(\+58)?[0-9]{10}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Número de teléfono inválido'
    }),
    
  buyerDocument: Joi.string()
    .pattern(/^[VE]?[0-9]{6,9}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Documento de identidad inválido'
    }),
  
  // Comprobante de pago en base64 (opcional)
  paymentProofBase64: Joi.string()
    .optional()
});

// Esquema para filtros de búsqueda
const searchFiltersSchema = Joi.object({
  status: Joi.alternatives().try(
    Joi.string().valid(...Object.values(RaffleStatus)),
    Joi.array().items(Joi.string().valid(...Object.values(RaffleStatus)))
  ).optional(),
  
  mode: Joi.alternatives().try(
    Joi.string().valid(...Object.values(RaffleMode)),
    Joi.array().items(Joi.string().valid(...Object.values(RaffleMode)))
  ).optional(),
  
  visibility: Joi.alternatives().try(
    Joi.string().valid(...Object.values(RaffleVisibility)),
    Joi.array().items(Joi.string().valid(...Object.values(RaffleVisibility)))
  ).optional(),
  
  hostId: Joi.string().uuid().optional(),
  
  minPot: Joi.number().positive().optional(),
  maxPot: Joi.number().positive().greater(Joi.ref('minPot')).optional(),
  
  search: Joi.string().max(100).allow('').optional(),
  
  sortBy: Joi.string()
    .valid('created', 'ending', 'pot', 'sold')
    .default('created'),
    
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc'),
    
  page: Joi.number()
    .integer()
    .positive()
    .default(1),
    
  limit: Joi.number()
    .integer()
    .positive()
    .max(100)
    .default(20)
});

// Esquema para aprobar/rechazar pago
const reviewPaymentSchema = Joi.object({
  action: Joi.string()
    .valid('approve', 'reject')
    .required(),
    
  reason: Joi.when('action', {
    is: 'reject',
    then: Joi.string().required().max(200),
    otherwise: Joi.optional()
  }),
  
  notes: Joi.string().max(500).optional()
});

// Esquema para múltiples números
const batchNumbersSchema = Joi.object({
  numbers: Joi.array()
    .items(Joi.number().integer().min(1))
    .min(1)
    .max(SystemLimits.MAX_NUMBERS_PER_USER)
    .required()
    .messages({
      'array.min': 'Debes seleccionar al menos un número',
      'array.max': `No puedes seleccionar más de ${SystemLimits.MAX_NUMBERS_PER_USER} números`
    })
});

// Validador de código de rifa
const raffleCodeSchema = Joi.string()
  .pattern(/^[0-9]{6}$/)
  .required()
  .messages({
    'string.pattern.base': 'Código de rifa inválido (6 dígitos)',
    'any.required': 'El código es requerido'
  });

// Validador de índice de número
const numberIndexSchema = Joi.number()
  .integer()
  .min(1)
  .max(SystemLimits.MAX_NUMBERS)
  .required()
  .messages({
    'number.min': 'Número inválido',
    'number.max': 'Número fuera de rango',
    'any.required': 'El número es requerido'
  });

// Middleware de validación
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.reduce((acc, detail) => {
        acc[detail.path.join('.')] = detail.message;
        return acc;
      }, {});
      
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    req.validatedData = value;
    next();
  };
};

// Validador de parámetros
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false
    });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors: error.details.map(d => d.message)
      });
    }
    
    req.validatedParams = value;
    next();
  };
};

// Validador de query
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false
    });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: error.details.map(d => d.message)
      });
    }
    
    req.validatedQuery = value;
    next();
  };
};

module.exports = {
  // Schemas
  createRaffleSchema,
  updateRaffleSchema,
  purchaseNumberSchema,
  searchFiltersSchema,
  reviewPaymentSchema,
  batchNumbersSchema,
  raffleCodeSchema,
  numberIndexSchema,
  
  // Middleware
  validate,
  validateParams,
  validateQuery
};
