/**
 * RaffleService - Servicio completo para el sistema de rifas
 * Implementa todas las operaciones principales del sistema
 */
const { Pool } = require('pg');
const crypto = require('crypto');
const logger = require('../utils/logger');
const RoomCodeService = require('./roomCodeService');

class RaffleService {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
        });
    }

    /**
     * Generar código aleatorio de CAPTCHA matemático
     */
    generateMathCaptcha() {
        const operations = ['+', '-', '*'];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        let num1, num2, answer;
        
        switch(operation) {
            case '+':
                num1 = Math.floor(Math.random() * 50) + 1;
                num2 = Math.floor(Math.random() * 50) + 1;
                answer = num1 + num2;
                break;
            case '-':
                num1 = Math.floor(Math.random() * 50) + 10;
                num2 = Math.floor(Math.random() * num1);
                answer = num1 - num2;
                break;
            case '*':
                num1 = Math.floor(Math.random() * 12) + 1;
                num2 = Math.floor(Math.random() * 12) + 1;
                answer = num1 * num2;
                break;
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        
        return {
            question: `${num1} ${operation} ${num2} = ?`,
            answer: answer.toString(),
            token: token,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
        };
    }

    /**
     * Verificar CAPTCHA matemático
     */
    verifyMathCaptcha(token, userAnswer) {
        // En implementación real, verificar contra base de datos o caché
        // Por ahora, simplificado
        return { valid: true };
    }

    /**
     * Crear nueva rifa
     */
    async createRaffle(hostId, raffleData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Normalizar mode: 'fire' → 'fires', 'prize' → 'prize'
            const modeMap = {
                'fire': 'fires',
                'fires': 'fires',
                'prize': 'prize'
            };
            
            const rawMode = raffleData.mode || 'fire';
            const normalizedMode = modeMap[rawMode];
            
            if (!normalizedMode) {
                throw new Error(`Modo inválido: ${rawMode}. Modos permitidos: fires, prize`);
            }
            
            logger.info('Mode normalized', {
                rawMode,
                normalizedMode
            });
            
            // Verificar experiencia del usuario
            const userCheck = await client.query(
                'SELECT experience, username FROM users WHERE id = $1',
                [hostId]
            );

            if (!userCheck.rows[0]) {
                throw new Error('Usuario no encontrado');
            }

            const userExperience = parseInt(userCheck.rows[0].experience) || 0;
            const hostUsername = userCheck.rows[0].username;
            
            // SOLO modo fires requiere 10 de experiencia
            // Modo prize NO requiere experiencia
            if (normalizedMode === 'fires' && userExperience < 10) {
                throw new Error(`Necesitas al menos 10 puntos de experiencia para crear rifas con fuegos. Tienes ${userExperience}.`);
            }
            
            logger.info('Experience check passed', {
                hostId,
                userExperience,
                mode: normalizedMode,
                requiresXP: normalizedMode === 'fires'
            });

            // REGLAS DE COBRO:
            // 1. FIRES: Host paga cost_per_number al admin (NO permite empresa)
            // 2. PRIZE normal: Host paga 300🔥 al admin
            // 3. PRIZE empresa: Host paga 3000🔥 al admin
            
            const isCompanyMode = raffleData.is_company_mode || false;
            const costPerNumber = parseFloat(raffleData.cost_per_number) || 10;
            let platformFee = 0;  // Lo que paga el host al admin
            
            if (normalizedMode === 'fires') {
                // MODO FIRES: NO permite empresa
                if (isCompanyMode) {
                    throw new Error('El modo empresa no está disponible para rifas de fuegos');
                }
                // Host paga el cost_per_number al admin
                platformFee = costPerNumber;
                logger.info('Fires mode: platform fee = cost_per_number', { platformFee, costPerNumber });
                
            } else if (normalizedMode === 'prize') {
                // MODO PRIZE: cobra 300 (normal) o 3000 (empresa)
                platformFee = isCompanyMode ? 3000 : 300;
                logger.info('Prize mode: platform fee', { platformFee, isCompanyMode });
            } else {
                throw new Error('Modo de rifa inválido');
            }
            
            // Verificar balance del host
            const hostWalletCheck = await client.query(`
                SELECT w.fires_balance 
                FROM wallets w 
                WHERE w.user_id = $1
            `, [hostId]);
            
            if (!hostWalletCheck.rows[0]) {
                throw new Error('Wallet del host no encontrado');
            }
            
            const hostBalance = parseFloat(hostWalletCheck.rows[0].fires_balance);
            
            if (hostBalance < platformFee) {
                throw new Error(`Necesitas ${platformFee} fuegos para crear esta rifa. Tienes ${hostBalance} fuegos.`);
            }
            
            logger.info('Balance check passed', {
                hostId,
                hostBalance,
                platformFee,
                normalizedMode,
                isCompanyMode
            });
            
            logger.info('Creating raffle - deducting platform fee from host', {
                hostId,
                platformFee,
                mode: normalizedMode,
                isCompanyMode
            });
            
            // Insertar rifa primero con código temporal para obtener ID
            const raffleResult = await client.query(`
                INSERT INTO raffles (
                    code, name, host_id, description, mode, type,
                    entry_price_fire, entry_price_coin, entry_price_fiat,
                    numbers_range, visibility, status,
                    is_company_mode, company_cost, close_type, 
                    scheduled_close_at, terms_conditions,
                    prize_meta, host_meta
                ) VALUES (
                    'TEMP', $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10, 'pending',
                    $11, $12, $13,
                    $14, $15,
                    $16, $17
                ) RETURNING *
            `, [
                raffleData.name,
                hostId,
                raffleData.description || null,
                normalizedMode,
                raffleData.type || 'public',
                normalizedMode === 'fires' ? costPerNumber : 0,  // entryPriceFire
                0,  // entryPriceCoin
                0,  // entryPriceFiat
                raffleData.numbers_range || 100,
                raffleData.visibility || 'public',
                isCompanyMode,
                isCompanyMode ? 3000 : 0,
                raffleData.close_type || 'auto_full',
                raffleData.scheduled_close_at || null,
                raffleData.terms_conditions || null,
                JSON.stringify(raffleData.prize_meta || {}),
                JSON.stringify(raffleData.host_meta || {})
            ]);

            const raffle = raffleResult.rows[0];
            
            // Generar código único usando sistema unificado
            const raffleCode = await RoomCodeService.reserveCode('raffle', raffle.id, client);
            
            // Actualizar rifa con código real
            await client.query(
                'UPDATE raffles SET code = $1 WHERE id = $2',
                [raffleCode, raffle.id]
            );
            
            raffle.code = raffleCode;
            
            logger.info('🎟️ Rifa creada con código unificado', {
                raffleId: raffle.id,
                code: raffleCode,
                hostId,
                mode: normalizedMode
            });
            
            // 1. Descontar del host
            await client.query(`
                UPDATE wallets 
                SET fires_balance = fires_balance - $1 
                WHERE user_id = $2
            `, [platformFee, hostId]);
            
            // 2. Transferir al admin de plataforma (tg_id 1417856820)
            const adminTgId = '1417856820';
            const adminCheck = await client.query(`
                SELECT id FROM users WHERE tg_id = $1
            `, [adminTgId]);
            
            if (adminCheck.rows.length === 0) {
                throw new Error('Admin de plataforma no encontrado en base de datos');
            }
            
            const adminUserId = adminCheck.rows[0].id;
            
            logger.info('Transferring platform fee to admin', {
                adminUserId,
                platformFee,
                raffleCode
            });
            
            // Acreditar al admin
            await client.query(`
                UPDATE wallets 
                SET fires_balance = fires_balance + $1 
                WHERE user_id = $2
            `, [platformFee, adminUserId]);
            
            // 3. Registrar transacción del admin
            const adminDescription = normalizedMode === 'fires'
                ? `Comisión rifa fuegos ${raffleCode}`
                : isCompanyMode
                    ? `Comisión rifa premio empresa ${raffleCode}`
                    : `Comisión rifa premio ${raffleCode}`;
            
            await client.query(`
                INSERT INTO wallet_transactions 
                (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                VALUES (
                    (SELECT id FROM wallets WHERE user_id = $1),
                    'raffle_platform_fee', 'fires', $2,
                    (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
                    (SELECT fires_balance FROM wallets WHERE user_id = $1),
                    $3, $4
                )
            `, [adminUserId, platformFee, raffleCode, adminDescription]);
            
            // 4. Registrar transacción del host
            const hostDescription = normalizedMode === 'fires'
                ? `Creación rifa fuegos ${raffleCode} (${costPerNumber}🔥/número)`
                : isCompanyMode
                    ? `Creación rifa premio empresa ${raffleCode}`
                    : `Creación rifa premio ${raffleCode}`;
            
            await client.query(`
                INSERT INTO wallet_transactions 
                (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                VALUES (
                    (SELECT id FROM wallets WHERE user_id = $1),
                    'raffle_creation_cost', 'fires', $2,
                    (SELECT fires_balance + $2 FROM wallets WHERE user_id = $1),
                    (SELECT fires_balance FROM wallets WHERE user_id = $1),
                    $3, $4
                )
            `, [hostId, platformFee, raffleCode, hostDescription]);

            // Si es modo empresa, crear configuración de empresa
            if (isCompanyMode && raffleData.company_config) {
                try {
                    await client.query(`
                        INSERT INTO raffle_companies (
                            raffle_id, company_name, rif_number,
                            brand_color, logo_url, website_url
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        raffle.id,
                        raffleData.company_config.company_name || 'Empresa',
                        raffleData.company_config.company_rif || raffleData.company_config.rif_number || null,
                        raffleData.company_config.brand_color || raffleData.company_config.primary_color || '#8B5CF6',
                        raffleData.company_config.logo_url || null,
                        raffleData.company_config.website_url || null
                    ]);
                } catch (companyError) {
                    // Si la tabla no existe o tiene problemas, solo logueamos y continuamos
                    logger.warn('Could not create raffle_companies entry', {
                        error: companyError.message,
                        raffleId: raffle.id
                    });
                }
            }

            // Generar números disponibles para la rifa
            await this.generateRaffleNumbers(client, raffle.id, raffle.numbers_range);

            await client.query('COMMIT');

            logger.info('Raffle creation completed successfully', {
                raffleId: raffle.id,
                raffleCode: raffle.code,
                numbersGenerated: raffle.numbers_range
            });

            // Retornar datos básicos de la rifa (evitar getRaffleDetails que puede fallar por esquema)
            return {
                ...raffle,
                host_username: hostUsername,
                purchased_count: 0,
                numbers: []
            };

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error creating raffle - transaction rolled back', {
                error: error.message,
                code: error.code,
                detail: error.detail,
                hint: error.hint,
                position: error.position,
                hostId,
                raffleData: {
                    name: raffleData.name,
                    mode: raffleData.mode,
                    type: raffleData.type
                }
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Generar números disponibles para una rifa
     */
    async generateRaffleNumbers(client, raffleId, numbersRange) {
        const rangeConfig = this.getNumberRangeConfig(numbersRange);
        const { start, end, format } = rangeConfig;

        logger.info('Generating raffle numbers', {
            raffleId,
            numbersRange,
            start,
            end,
            totalNumbers: end - start + 1
        });

        for (let i = start; i <= end; i++) {
            await client.query(`
                INSERT INTO raffle_numbers (raffle_id, number_idx, state)
                VALUES ($1, $2, 'available')
                ON CONFLICT (raffle_id, number_idx) DO NOTHING
            `, [raffleId, i]);
        }

        logger.info('Raffle numbers generated successfully', {
            raffleId,
            totalGenerated: end - start + 1
        });
    }

    /**
     * Obtener configuración de rango de números
     */
    getNumberRangeConfig(range) {
        switch(range) {
            case 99:
                return { start: 0, end: 99, format: '00' };
            case 999:
                return { start: 0, end: 999, format: '000' };
            case 9999:
                return { start: 0, end: 9999, format: '0000' };
            default:
                return { start: 0, end: range - 1, format: '00' };
        }
    }

    /**
     * Formatear número según configuración
     */
    formatNumber(number, format) {
        return number.toString().padStart(format.length, '0');
    }

    /**
     * Formatear number_idx para display visual
     */
    formatNumberForDisplay(numberIdx, numbersRange) {
        const format = this.getNumberRangeConfig(numbersRange).format;
        return numberIdx.toString().padStart(format.length, '0');
    }

    /**
     * Comprar múltiples números de rifa (NUEVO - soporta modo fuegos y premio)
     * @param {string} userId - ID del usuario
     * @param {object} options - Opciones de compra
     * @param {string} options.raffleId - ID de la rifa
     * @param {number[]} options.numbers - Array de índices de números
     * @param {string} options.mode - Modo de rifa ('fires' o 'prize')
     * @param {object} options.buyerProfile - Perfil del comprador (solo premio)
     * @param {string} options.paymentMethod - Método de pago (solo premio)
     * @param {string} options.paymentReference - Referencia de pago (opcional)
     * @param {string} options.message - Mensaje al host (opcional)
     */
    async purchaseNumbers(userId, options) {
        const { raffleId, numbers, mode, buyerProfile, paymentMethod, paymentReference, message } = options;
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');

            // Obtener detalles de la rifa
            const raffleResult = await client.query(`
                SELECT * FROM raffles WHERE id = $1 AND (status = 'pending' OR status = 'active')
            `, [raffleId]);

            if (!raffleResult.rows[0]) {
                throw new Error('La rifa no existe o no está activa');
            }

            const raffleData = raffleResult.rows[0];
            const normalizedMode = raffleData.mode === 'fire' ? 'fires' : raffleData.mode;
            const cost = parseFloat(raffleData.entry_price_fire || raffleData.cost_per_number || 10);

            // Procesar según modo
            if (normalizedMode === 'fires') {
                // MODO FUEGOS: compra directa sin CAPTCHA
                
                // Verificar balance del usuario
                const wallet = await client.query(`
                    SELECT fires_balance FROM wallets WHERE user_id = $1
                `, [userId]);

                if (!wallet.rows[0]) {
                    throw new Error('Wallet no encontrado');
                }

                const totalCost = cost * numbers.length;
                const currentBalance = parseFloat(wallet.rows[0].fires_balance);

                if (currentBalance < totalCost) {
                    throw new Error(`Balance insuficiente. Necesitas ${totalCost} fuegos.`);
                }

                // Procesar cada número
                for (const numberIdx of numbers) {
                    await this.processFirePurchase(client, userId, raffleId, numberIdx, cost);
                }

                logger.info('Compra modo fuegos completada', {
                    userId,
                    raffleId,
                    numbers: numbers.length,
                    totalCost
                });

            } else if (normalizedMode === 'prize') {
                // MODO PREMIO: reserva con aprobación
                
                // Validar que buyerProfile esté completo
                if (!buyerProfile || !buyerProfile.full_name || !buyerProfile.id_number || !buyerProfile.phone) {
                    throw new Error('Perfil de comprador incompleto');
                }

                // Procesar cada número (reserva + solicitud)
                for (const numberIdx of numbers) {
                    await this.processPrizePurchase(client, userId, raffleId, numberIdx, cost, {
                        buyerProfile,
                        paymentMethod,
                        paymentReference,
                        message
                    });
                }

                logger.info('Reservas modo premio creadas', {
                    userId,
                    raffleId,
                    numbers: numbers.length,
                    paymentMethod
                });
            } else {
                throw new Error(`Modo de rifa no soportado: ${normalizedMode}`);
            }

            await client.query('COMMIT');

            // Retornar detalles actualizados de la rifa
            return await this.getRaffleDetails(raffleId);

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error en purchaseNumbers', {
                userId,
                raffleId,
                numbers: options.numbers,
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Comprar número de rifa (DEPRECADO - usar purchaseNumbers)
     */
    async purchaseNumber(userId, raffleId, number, captchaData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar CAPTCHA
            const captchaValid = this.verifyMathCaptcha(captchaData.token, captchaData.answer);
            if (!captchaData.valid) {
                throw new Error('CAPTCHA incorrecto. Por favor intenta nuevamente.');
            }

            // Obtener detalles de la rifa
            const raffle = await client.query(`
                SELECT * FROM raffles WHERE id = $1 AND status = 'pending'
            `, [raffleId]);

            if (!raffle.rows[0]) {
                throw new Error('La rifa no existe o no está activa');
            }

            const raffleData = raffle.rows[0];
            const cost = parseFloat(raffleData.entry_price_fire);

            // Verificar disponibilidad del número (number viene del frontend como índice)
            const numberCheck = await client.query(`
                SELECT * FROM raffle_numbers 
                WHERE raffle_id = $1 AND number_idx = $2
            `, [raffleId, number]);

            if (!numberCheck.rows[0]) {
                throw new Error('El número no existe en esta rifa');
            }

            const numberData = numberCheck.rows[0];
            if (numberData.state !== 'available') {
                throw new Error('El número no está disponible');
            }

            // Verificar balance del usuario
            const wallet = await client.query(`
                SELECT * FROM wallets WHERE user_id = $1
            `, [userId]);

            if (!wallet.rows[0] || parseFloat(wallet.rows[0].fires_balance) < cost) {
                throw new Error('Balance insuficiente');
            }

            // Para compras mayores a 5000 fuegos, verificar contraseña
            if (cost > 5000) {
                // Aquí debería verificarse la contraseña del usuario
                // Por ahora, simplificado
            }

            // Procesar compra según modo (normalizar fires/fire)
            const normalizedMode = raffleData.mode === 'fire' ? 'fires' : raffleData.mode;
            if (normalizedMode === 'fires') {
                // Modo fuego: descontar directamente
                await this.processFirePurchase(client, userId, raffleId, number, cost);
            } else if (normalizedMode === 'prize') {
                // Modo premio: crear solicitud de aprobación
                await this.processPrizePurchase(client, userId, raffleId, number, cost, captchaData);
            }

            await client.query('COMMIT');

            return await this.getRaffleDetails(raffleId);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Procesar compra en modo fuego
     */
    async processFirePurchase(client, userId, raffleId, numberIdx, cost) {
        logger.info('🔥 processFirePurchase INICIADO', {
            userId,
            raffleId,
            numberIdx,
            cost,
            timestamp: new Date().toISOString()
        });
        
        // Descontar balance
        await client.query(`
            UPDATE wallets 
            SET fires_balance = fires_balance - $1 
            WHERE user_id = $2
        `, [cost, userId]);
        
        logger.info('💰 BALANCE DESCONTADO', {
            userId,
            amount: cost,
            timestamp: new Date().toISOString()
        });

        // Obtener el ID del número
        const numberResult = await client.query(`
            SELECT id FROM raffle_numbers
            WHERE raffle_id = $1 AND number_idx = $2
        `, [raffleId, numberIdx]);

        const numberId = numberResult.rows[0].id;

        // Actualizar estado del número
        await client.query(`
            UPDATE raffle_numbers 
            SET state = 'sold', owner_id = $1, sold_at = CURRENT_TIMESTAMP
            WHERE raffle_id = $2 AND number_idx = $3
        `, [userId, raffleId, numberIdx]);

        // Registrar compra
        const purchaseResult = await client.query(`
            INSERT INTO raffle_purchases (
                raffle_id, user_id, number_id, number, cost_amount, currency, 
                purchase_type, status
            ) VALUES ($1, $2, $3, $4, $5, 'fires', 'fire', 'completed')
            RETURNING id
        `, [raffleId, userId, numberId, numberIdx.toString(), cost]);

        // Crear ticket digital
        await this.createDigitalTicket(client, raffleId, userId, numberIdx, purchaseResult.rows[0].id);

        // Actualizar pozo de la rifa
        await client.query(`
            UPDATE raffles 
            SET pot_fires = pot_fires + $1
            WHERE id = $2
        `, [cost, raffleId]);

        // Verificar si la rifa se completó para cerrarla automáticamente
        await this.checkRaffleCompletion(client, raffleId);
    }

    /**
     * Procesar compra en modo premio
     * Reserva el número y crea solicitud de aprobación con buyer_profile completo
     */
    async processPrizePurchase(client, userId, raffleId, numberIdx, cost, purchaseData) {
        const { buyerProfile, paymentMethod, paymentReference, message } = purchaseData;
        
        // Validar que paymentMethod esté presente y sea válido
        if (!paymentMethod || !['cash', 'bank', 'fire'].includes(paymentMethod)) {
            throw new Error('Método de pago inválido o no especificado');
        }
        
        // Obtener configuración de la rifa para validar métodos habilitados
        const raffleConfig = await client.query(`
            SELECT payment_method, allow_fire_payments 
            FROM raffles 
            WHERE id = $1
        `, [raffleId]);
        
        if (!raffleConfig.rows[0]) {
            throw new Error('Rifa no encontrada');
        }
        
        const { payment_method: hostMethod, allow_fire_payments } = raffleConfig.rows[0];
        
        // Validar que el método elegido esté habilitado
        if (paymentMethod === 'fire' && !allow_fire_payments) {
            throw new Error('El pago con fuegos no está habilitado para esta rifa');
        }
        
        if ((paymentMethod === 'cash' || paymentMethod === 'bank') && paymentMethod !== hostMethod) {
            throw new Error(`Método de pago ${paymentMethod} no está configurado por el anfitrion`);
        }
        
        // Si es método fire, verificar balance del comprador
        if (paymentMethod === 'fire') {
            const walletCheck = await client.query(`
                SELECT fires_balance FROM wallets WHERE user_id = $1
            `, [userId]);
            
            if (!walletCheck.rows[0]) {
                throw new Error('Wallet no encontrada');
            }
            
            const currentBalance = parseFloat(walletCheck.rows[0].fires_balance);
            if (currentBalance < cost) {
                throw new Error(`Balance insuficiente. Necesitas ${cost} fuegos, tienes ${currentBalance}`);
            }
        }
        
        // Verificar que el número esté disponible
        const numberCheck = await client.query(`
            SELECT state FROM raffle_numbers 
            WHERE raffle_id = $1 AND number_idx = $2
        `, [raffleId, numberIdx]);

        if (!numberCheck.rows[0]) {
            throw new Error(`Número ${numberIdx} no existe en esta rifa`);
        }

        if (numberCheck.rows[0].state !== 'available') {
            throw new Error(`Número ${numberIdx} no está disponible`);
        }

        // Reservar número
        await client.query(`
            UPDATE raffle_numbers 
            SET state = 'reserved', owner_id = $1, reserved_until = CURRENT_TIMESTAMP + INTERVAL '24 hours'
            WHERE raffle_id = $2 AND number_idx = $3
        `, [userId, raffleId, numberIdx]);

        // Crear solicitud de aprobación con campos estructurados
        await client.query(`
            INSERT INTO raffle_requests (
                raffle_id, 
                user_id, 
                request_type, 
                status, 
                request_data, 
                buyer_profile, 
                payment_method, 
                payment_reference, 
                message,
                fire_amount,
                history
            ) VALUES ($1, $2, 'approval', 'pending', $3, $4, $5, $6, $7, $8, $9)
        `, [
            raffleId, 
            userId, 
            JSON.stringify({ number_idx: numberIdx, cost }), 
            JSON.stringify(buyerProfile),
            paymentMethod,
            paymentReference || null,
            message || null,
            paymentMethod === 'fire' ? cost : 0,
            JSON.stringify([{
                action: 'created',
                timestamp: new Date().toISOString(),
                user_id: userId,
                payment_method: paymentMethod
            }])
        ]);

        logger.info('Solicitud de compra modo premio creada', {
            userId,
            raffleId,
            numberIdx,
            paymentMethod
        });
    }

    /**
     * Aprobar solicitud de compra (modo premio)
     */
    async approvePurchase(hostId, requestId) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Obtener solicitud
            const request = await client.query(`
                SELECT rr.*, r.host_id, r.entry_price_fire, r.mode
                FROM raffle_requests rr
                JOIN raffles r ON rr.raffle_id = r.id
                WHERE rr.id = $1 AND rr.status = 'pending'
            `, [requestId]);

            if (!request.rows[0]) {
                throw new Error('Solicitud no encontrada o ya procesada');
            }

            const requestData = request.rows[0];
            const parsedRequestData = JSON.parse(requestData.request_data || '{}');
            const numberIdx = parsedRequestData.number_idx;
            
            // Verificar que sea el host
            if (requestData.host_id !== hostId) {
                throw new Error('No autorizado para aprobar esta solicitud');
            }

            const cost = parseFloat(requestData.entry_price_fire);
            const paymentMethod = requestData.payment_method;
            const fireAmount = parseFloat(requestData.fire_amount || 0);

            // Si el método es fire, procesar transferencia de fuegos
            if (paymentMethod === 'fire') {
                // 1. Verificar balance actual del comprador
                const buyerWallet = await client.query(`
                    SELECT fires_balance FROM wallets WHERE user_id = $1
                `, [requestData.user_id]);
                
                if (!buyerWallet.rows[0]) {
                    throw new Error('Wallet del comprador no encontrada');
                }
                
                const buyerBalance = parseFloat(buyerWallet.rows[0].fires_balance);
                if (buyerBalance < fireAmount) {
                    throw new Error(`El comprador ya no tiene suficientes fuegos. Necesita ${fireAmount}, tiene ${buyerBalance}`);
                }
                
                // 2. Descontar fuegos del comprador
                await client.query(`
                    UPDATE wallets 
                    SET fires_balance = fires_balance - $1,
                        total_fires_spent = total_fires_spent + $1
                    WHERE user_id = $2
                `, [fireAmount, requestData.user_id]);
                
                // 3. Acreditar fuegos al host
                await client.query(`
                    UPDATE wallets 
                    SET fires_balance = fires_balance + $1
                    WHERE user_id = $2
                `, [fireAmount, requestData.host_id]);
                
                // 4. Registrar transacción del comprador
                await client.query(`
                    INSERT INTO wallet_transactions 
                    (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                    VALUES (
                        (SELECT id FROM wallets WHERE user_id = $1),
                        'raffle_fire_payment', 'fires', $2,
                        (SELECT fires_balance + $2 FROM wallets WHERE user_id = $1),
                        (SELECT fires_balance FROM wallets WHERE user_id = $1),
                        $3, $4
                    )
                `, [
                    requestData.user_id,
                    fireAmount,
                    requestData.raffle_id,
                    `Pago rifa ${requestData.raffle_id} - Número ${numberIdx}`
                ]);
                
                // 5. Registrar transacción del host
                await client.query(`
                    INSERT INTO wallet_transactions 
                    (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                    VALUES (
                        (SELECT id FROM wallets WHERE user_id = $1),
                        'raffle_fire_received', 'fires', $2,
                        (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
                        (SELECT fires_balance FROM wallets WHERE user_id = $1),
                        $3, $4
                    )
                `, [
                    requestData.host_id,
                    fireAmount,
                    requestData.raffle_id,
                    `Recibido de venta Número ${numberIdx} - Rifa ${requestData.raffle_id}`
                ]);
                
                logger.info('Transferencia de fuegos completada', {
                    from: requestData.user_id,
                    to: requestData.host_id,
                    amount: fireAmount,
                    raffleId: requestData.raffle_id,
                    numberIdx
                });
            }

            // Obtener ID del número
            const numberResult = await client.query(`
                SELECT id FROM raffle_numbers
                WHERE raffle_id = $1 AND number_idx = $2
            `, [requestData.raffle_id, numberIdx]);

            const numberId = numberResult.rows[0].id;

            // Procesar compra aprobada
            await client.query(`
                UPDATE raffle_numbers 
                SET state = 'sold', owner_id = $1, sold_at = CURRENT_TIMESTAMP
                WHERE raffle_id = $2 AND number_idx = $3
            `, [requestData.user_id, requestData.raffle_id, numberIdx]);

            // Actualizar solicitud
            await client.query(`
                UPDATE raffle_requests 
                SET status = 'approved', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [hostId, requestId]);

            // Registrar compra
            const purchaseResult = await client.query(`
                INSERT INTO raffle_purchases (
                    raffle_id, user_id, number_id, number, cost_amount, currency, 
                    purchase_type, status
                ) VALUES ($1, $2, $3, $4, $5, 'fires', 'prize', 'completed')
                RETURNING id
            `, [requestData.raffle_id, requestData.user_id, numberId, numberIdx.toString(), cost]);

            // Crear ticket
            await this.createDigitalTicket(client, requestData.raffle_id, requestData.user_id, 
                numberIdx, purchaseResult.rows[0].id);

            // Actualizar métricas del usuario
            await client.query(`
                UPDATE users 
                SET raffles_played = raffles_played + 1 
                WHERE id = $1
            `, [requestData.user_id]);

            // Enviar notificación al comprador
            await client.query(`
                INSERT INTO messages (user_id, title, message, type, related_id)
                VALUES ($1, $2, $3, 'raffle_approved', $4)
            `, [
                requestData.user_id,
                '✅ Compra Aprobada',
                `Tu compra del número ${numberIdx} fue aprobada. ¡Buena suerte!`,
                requestData.raffle_id
            ]);

            await client.query('COMMIT');

            logger.info('Compra aprobada', {
                requestId,
                userId: requestData.user_id,
                raffleId: requestData.raffle_id,
                numberIdx
            });

            return { success: true, message: 'Compra aprobada exitosamente' };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Crear ticket digital con QR
     */
    async createDigitalTicket(client, raffleId, userId, numberIdx, purchaseId) {
        const ticketNumber = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        // Obtener number_id
        const numberResult = await client.query(`
            SELECT id FROM raffle_numbers
            WHERE raffle_id = $1 AND number_idx = $2
        `, [raffleId, numberIdx]);

        if (!numberResult.rows[0]) {
            throw new Error('Número no encontrado para crear ticket');
        }

        const numberId = numberResult.rows[0].id;
        
        // Generar QR (simulado por ahora)
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticketNumber}`;

        // Verificar si la tabla raffle_tickets existe, si no, solo retornar
        try {
            await client.query(`
                INSERT INTO raffle_tickets (
                    raffle_id, user_id, number_id, ticket_number, qr_code_url, purchase_id
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [raffleId, userId, numberId, ticketNumber, qrCodeUrl, purchaseId]);
        } catch (error) {
            // Si la tabla no existe, simplemente logueamos y continuamos
            logger.warn('raffle_tickets table might not exist, skipping ticket creation', {
                error: error.message,
                raffleId,
                numberIdx
            });
        }
    }

    /**
     * Verificar si la rifa se completó para cerrar
     */
    async checkRaffleCompletion(client, raffleId) {
        const raffle = await client.query(`
            SELECT * FROM raffles WHERE id = $1
        `, [raffleId]);

        const raffleData = raffle.rows[0];
        
        // Normalizar mode
        const normalizedMode = raffleData.mode === 'fire' ? 'fires' : raffleData.mode;
        
        if (normalizedMode === 'fires' && raffleData.close_type === 'auto_full') {
            // Verificar si todos los números están comprados
            const totalNumbers = await client.query(`
                SELECT COUNT(*) as total FROM raffle_numbers WHERE raffle_id = $1
            `, [raffleId]);

            const purchasedNumbers = await client.query(`
                SELECT COUNT(*) as purchased FROM raffle_numbers 
                WHERE raffle_id = $1 AND state = 'sold'
            `, [raffleId]);

            if (totalNumbers.rows[0].total === purchasedNumbers.rows[0].purchased) {
                // Cerrar rifa y seleccionar ganador
                await this.closeRaffleAndSelectWinner(client, raffleId);
            }
        }
    }

    /**
     * Cerrar rifa y seleccionar ganador
     */
    async closeRaffleAndSelectWinner(client, raffleId) {
        // Obtener número ganador aleatorio
        const winnerNumber = await client.query(`
            SELECT number_idx, owner_id FROM raffle_numbers 
            WHERE raffle_id = $1 AND state = 'sold'
            ORDER BY RANDOM() LIMIT 1
        `, [raffleId]);

        if (winnerNumber.rows[0]) {
            const winningNumberIdx = winnerNumber.rows[0].number_idx;
            const winnerId = winnerNumber.rows[0].owner_id;

            // Actualizar rifa
            await client.query(`
                UPDATE raffles 
                SET status = 'finished', winning_number = $1, winner_id = $2, ended_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [winningNumberIdx, winnerId, raffleId]);

            // Distribuir premios (70/20/10)
            await this.distributePrizes(client, raffleId, winningNumberIdx, winnerId);

            // Registrar ganador
            await client.query(`
                INSERT INTO raffle_winners (raffle_id, user_id, number, prize_amount, currency)
                VALUES ($1, $2, $3, (SELECT pot_fires * 0.7 FROM raffles WHERE id = $1), 'fires')
            `, [raffleId, winnerId, winningNumberIdx]);

            // Dar experiencia a todos los participantes (2 puntos)
            await client.query(`
                UPDATE users 
                SET experience = experience + 2
                WHERE id IN (
                    SELECT DISTINCT owner_id 
                    FROM raffle_numbers 
                    WHERE raffle_id = $1 AND state = 'sold' AND owner_id IS NOT NULL
                )
            `, [raffleId]);

            // Actualizar métricas del ganador
            await client.query(`
                UPDATE users 
                SET raffles_won = raffles_won + 1 
                WHERE id = $1
            `, [winnerId]);

            // Enviar notificaciones masivas
            const raffle = await client.query('SELECT * FROM raffles WHERE id = $1', [raffleId]);
            const raffleData = raffle.rows[0];

            // Notificar al ganador
            await client.query(`
                INSERT INTO messages (user_id, title, message, type, related_id)
                VALUES ($1, $2, $3, 'raffle_winner', $4)
            `, [
                winnerId,
                '🎉 ¡GANASTE LA RIFA!',
                `¡Felicidades! Ganaste la rifa "${raffleData.name}" con el número ${winningNumberIdx}. Premio: ${Math.floor(raffleData.pot_fires * 0.7)} 🔥`,
                raffleId
            ]);

            // Notificar a todos los participantes
            const participants = await client.query(`
                SELECT DISTINCT owner_id FROM raffle_numbers 
                WHERE raffle_id = $1 AND state = 'sold' AND owner_id != $2
            `, [raffleId, winnerId]);

            for (const participant of participants.rows) {
                await client.query(`
                    INSERT INTO messages (user_id, title, message, type, related_id)
                    VALUES ($1, $2, $3, 'raffle_finished', $4)
                `, [
                    participant.owner_id,
                    '🎲 Rifa Finalizada',
                    `La rifa "${raffleData.name}" finalizó. Número ganador: ${winningNumberIdx}. ¡Gracias por participar!`,
                    raffleId
                ]);
            }

            logger.info('Rifa cerrada con ganador', {
                raffleId,
                winnerId,
                winningNumber: winningNumberIdx,
                participants: participants.rows.length + 1
            });
        }
    }

    /**
     * Distribuir premios (70% ganador, 20% host, 10% plataforma)
     */
    async distributePrizes(client, raffleId, winningNumber, winnerId) {
        const raffle = await client.query(`
            SELECT * FROM raffles WHERE id = $1
        `, [raffleId]);

        const raffleData = raffle.rows[0];
        const totalPot = parseFloat(raffleData.pot_fires);

        // Premio para el ganador (70%)
        const winnerPrize = Math.floor(totalPot * 0.7);
        await client.query(`
            UPDATE wallets 
            SET fires_balance = fires_balance + $1 
            WHERE user_id = $2
        `, [winnerPrize, winnerId]);

        // Premio para el host (20%)
        const hostPrize = Math.floor(totalPot * 0.2);
        await client.query(`
            UPDATE wallets 
            SET fires_balance = fires_balance + $1 
            WHERE user_id = $2
        `, [hostPrize, raffleData.host_id]);

        // Comisión para plataforma (10%) - va a admin secreto
        const platformCommission = totalPot - winnerPrize - hostPrize;
        const adminId = '1417856820'; // Admin secreto
        
        // Verificar si existe wallet del admin
        const adminWallet = await client.query(`
            SELECT id FROM wallets WHERE user_id = $1
        `, [adminId]);

        if (adminWallet.rows[0]) {
            await client.query(`
                UPDATE wallets 
                SET fires_balance = fires_balance + $1 
                WHERE user_id = $2
            `, [platformCommission, adminId]);
        }
    }

    /**
     * Obtener detalles completos de una rifa
     */
    async getRaffleDetails(raffleId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as purchased_count
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
                WHERE r.id = $1
                GROUP BY r.id, u.username, rc.company_name
            `, [raffleId]);

            if (result.rows[0]) {
                // Obtener números de la rifa
                const numbers = await client.query(`
                    SELECT 
                        rn.*,
                        u.username as owner_username
                    FROM raffle_numbers rn
                    LEFT JOIN users u ON rn.owner_id = u.id
                    WHERE rn.raffle_id = $1 
                    ORDER BY rn.number_idx
                `, [raffleId]);

                result.rows[0].numbers = numbers.rows;

                // Obtener solicitudes pendientes si es modo premio
                if (result.rows[0].mode === 'prize') {
                    const requests = await client.query(`
                        SELECT 
                            rr.*,
                            u.username as user_username
                        FROM raffle_requests rr
                        JOIN users u ON rr.user_id = u.id
                        WHERE rr.raffle_id = $1 AND rr.status = 'pending'
                    `, [raffleId]);

                    result.rows[0].pending_requests = requests.rows;
                }
            }

            return result.rows[0];

        } finally {
            client.release();
        }
    }

    /**
     * Listar rifas públicas (para lobby)
     */
    async listPublicRaffles(page = 1, limit = 20, filters = {}) {
        const client = await this.pool.connect();
        try {
            let query = `
                SELECT 
                    r.id,
                    r.code,
                    r.name,
                    u.username as host_username,
                    r.mode,
                    COALESCE(r.type, 'public') as type,
                    r.status,
                    COALESCE(r.cost_per_number, 10) as cost_per_number,
                    (COALESCE(r.pot_fires, 0) + COALESCE(r.pot_coins, 0)) as current_pot,
                    r.numbers_range,
                    COALESCE(r.is_company_mode, false) as is_company_mode,
                    r.created_at,
                    NULL as company_name,
                    NULL as logo_url,
                    COUNT(DISTINCT CASE WHEN rn.state IN ('reserved', 'sold') THEN rn.id END) as purchased_count
                FROM raffles r
                LEFT JOIN users u ON u.id = r.host_id
                LEFT JOIN raffle_numbers rn ON rn.raffle_id = r.id
                WHERE r.status IN ('pending', 'active', 'finished')
                GROUP BY r.id, u.username
            `;
            
            const params = [];
            let paramIndex = 1;

            // Aplicar filtros
            if (filters.mode) {
                query += ` AND r.mode = $${paramIndex++}`;
                params.push(filters.mode);
            }

            if (filters.type) {
                query += ` AND r.type = $${paramIndex++}`;
                params.push(filters.type);
            }

            if (filters.company_mode !== undefined) {
                query += ` AND r.is_company_mode = $${paramIndex++}`;
                params.push(filters.company_mode);
            }

            if (filters.search) {
                query += ` AND (r.name ILIKE $${paramIndex++} OR r.host_username ILIKE $${paramIndex++})`;
                params.push(`%${filters.search}%`, `%${filters.search}%`);
            }

            // Ordenamiento y paginación
            query += ` ORDER BY r.created_at DESC`;
            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, (page - 1) * limit);

            const result = await client.query(query, params);

            // Obtener total para paginación (contar distintos raffles)
            let countQuery = query.split('ORDER BY')[0].replace(/SELECT.*?FROM/, 'SELECT COUNT(DISTINCT r.id) as count FROM');
            // Remover el GROUP BY para el count
            countQuery = countQuery.replace(/GROUP BY.*$/, '');
            const countResult = await client.query(countQuery, params.slice(0, -2));
            
            return {
                raffles: result.rows,
                pagination: {
                    page: page,
                    limit: limit,
                    total: parseInt(countResult.rows[0]?.count || 0),
                    totalPages: Math.ceil((countResult.rows[0]?.count || 0) / limit)
                }
            };

        } finally {
            client.release();
        }
    }

    /**
     * Obtener rifas activas del usuario
     */
    async getUserActiveRaffles(userId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    rc.logo_url
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                WHERE r.host_id = $1 AND r.status IN ('pending', 'active')
                ORDER BY r.created_at DESC
            `, [userId]);

            return result.rows;

        } finally {
            client.release();
        }
    }

    /**
     * Obtener rifas en las que participó el usuario
     */
    async getUserParticipatedRaffles(userId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT DISTINCT
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    rt.ticket_number,
                    rt.qr_code_url,
                    rn.number_idx as user_number
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                JOIN raffle_tickets rt ON r.id = rt.raffle_id
                JOIN raffle_numbers rn ON rt.number_id = rn.id
                WHERE rt.user_id = $1
                ORDER BY r.created_at DESC
            `, [userId]);

            return result.rows;

        } finally {
            client.release();
        }
    }

    /**
     * Obtener rifa por código
     */
    async getRaffleByCode(code) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT 
                    r.*,
                    u.username as host_username,
                    rc.company_name,
                    COUNT(CASE WHEN rn.state = 'sold' THEN 1 END) as purchased_count
                FROM raffles r
                JOIN users u ON r.host_id = u.id
                LEFT JOIN raffle_companies rc ON r.id = rc.raffle_id
                LEFT JOIN raffle_numbers rn ON r.id = rn.raffle_id
                WHERE r.code = $1
                GROUP BY r.id, u.username, rc.company_name
            `, [code]);

            if (result.rows[0]) {
                // Obtener números de la rifa
                const numbers = await client.query(`
                    SELECT 
                        rn.*,
                        u.username as owner_username
                    FROM raffle_numbers rn
                    LEFT JOIN users u ON rn.owner_id = u.id
                    WHERE rn.raffle_id = $1 
                    ORDER BY rn.number_idx
                `, [result.rows[0].id]);

                result.rows[0].numbers = numbers.rows;

                // Obtener solicitudes pendientes si es modo premio
                if (result.rows[0].mode === 'prize') {
                    const requests = await client.query(`
                        SELECT 
                            rr.*,
                            u.username as user_username
                        FROM raffle_requests rr
                        JOIN users u ON rr.user_id = u.id
                        WHERE rr.raffle_id = $1 AND rr.status = 'pending'
                    `, [result.rows[0].id]);

                    result.rows[0].pending_requests = requests.rows;
                }
            }

            return result.rows[0];

        } finally {
            client.release();
        }
    }

    /**
     * Rechazar solicitud de compra
     */
    async rejectPurchase(hostId, requestId, reason = null) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Obtener solicitud
            const request = await client.query(`
                SELECT rr.*, r.host_id
                FROM raffle_requests rr
                JOIN raffles r ON rr.raffle_id = r.id
                WHERE rr.id = $1 AND rr.status = 'pending'
            `, [requestId]);

            if (!request.rows[0]) {
                throw new Error('Solicitud no encontrada o ya procesada');
            }

            const requestData = request.rows[0];
            
            // Verificar que sea el host
            if (requestData.host_id !== hostId) {
                throw new Error('No autorizado para rechazar esta solicitud');
            }

            // Obtener number_idx de request_data
            const parsedRequestData = JSON.parse(requestData.request_data || '{}');
            const numberIdx = parsedRequestData.number_idx;

            // Liberar número reservado
            await client.query(`
                UPDATE raffle_numbers 
                SET state = 'available', owner_id = NULL, reserved_by_ext = NULL, reserved_until = NULL
                WHERE raffle_id = $1 AND number_idx = $2
            `, [requestData.raffle_id, numberIdx]);

            // Actualizar solicitud
            await client.query(`
                UPDATE raffle_requests 
                SET status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, admin_notes = $2
                WHERE id = $3
            `, [hostId, reason, requestId]);

            // Enviar notificación al comprador
            const notificationMsg = reason 
                ? `Tu solicitud del número ${numberIdx} fue rechazada. Motivo: ${reason}`
                : `Tu solicitud del número ${numberIdx} fue rechazada por el anfitrión.`;

            await client.query(`
                INSERT INTO messages (user_id, title, message, type, related_id)
                VALUES ($1, $2, $3, 'raffle_rejected', $4)
            `, [
                requestData.user_id,
                '❌ Solicitud Rechazada',
                notificationMsg,
                requestData.raffle_id
            ]);

            await client.query('COMMIT');

            logger.info('Compra rechazada', {
                requestId,
                userId: requestData.user_id,
                raffleId: requestData.raffle_id,
                numberIdx,
                reason
            });

            return { success: true, message: 'Compra rechazada' };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener números de rifa
     */
    async getRaffleNumbers(code) {
        const client = await this.pool.connect();
        try {
            // Obtener ID de rifa por código
            const raffle = await client.query(`
                SELECT id FROM raffles WHERE code = $1
            `, [code]);

            if (!raffle.rows[0]) {
                throw new Error('Rifa no encontrada');
            }

            const numbers = await client.query(`
                SELECT 
                    rn.*,
                    u.username as owner_username
                FROM raffle_numbers rn
                LEFT JOIN users u ON rn.owner_id = u.id
                WHERE rn.raffle_id = $1
                ORDER BY rn.number_idx
            `, [raffle.rows[0].id]);

            return numbers.rows;

        } finally {
            client.release();
        }
    }

    /**
     * Cerrar rifa manualmente
     */
    async closeRaffleManually(userId, code) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Obtener rifa
            const raffle = await client.query(`
                SELECT * FROM raffles WHERE code = $1
            `, [code]);

            if (!raffle.rows[0]) {
                throw new Error('Rifa no encontrada');
            }

            const raffleData = raffle.rows[0];

            // Verificar que sea el host
            if (raffleData.host_id !== userId) {
                throw new Error('Solo el host puede cerrar la rifa');
            }

            if (raffleData.status !== 'pending' && raffleData.status !== 'active') {
                throw new Error('La rifa no está activa');
            }

            // Cerrar y seleccionar ganador
            await this.closeRaffleAndSelectWinner(client, raffleData.id);

            await client.query('COMMIT');

            return await this.getRaffleDetails(raffleData.id);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Validar ticket digital
     */
    async validateTicket(code, ticketNumber) {
        const client = await this.pool.connect();
        try {
            // Obtener rifa
            const raffle = await client.query(`
                SELECT id FROM raffles WHERE code = $1
            `, [code]);

            if (!raffle.rows[0]) {
                return null;
            }

            // Buscar ticket
            const ticket = await client.query(`
                SELECT 
                    rt.*,
                    r.name as raffle_name,
                    r.code as raffle_code,
                    u.username as owner_username,
                    rn.number_idx as ticket_number_idx
                FROM raffle_tickets rt
                JOIN raffles r ON rt.raffle_id = r.id
                JOIN users u ON rt.user_id = u.id
                JOIN raffle_numbers rn ON rt.number_id = rn.id
                WHERE rt.ticket_number = $1 AND r.code = $2
            `, [ticketNumber, code]);

            return ticket.rows[0] || null;

        } finally {
            client.release();
        }
    }

    /**
     * Obtener estadísticas del sistema
     */
    async getSystemStats() {
        const client = await this.pool.connect();
        try {
            const stats = await client.query(`
                SELECT 
                    COUNT(*) as total_raffles,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_raffles,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_raffles,
                    COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_raffles,
                    COALESCE(SUM(pot_fires), 0) as total_fires_in_play,
                    COALESCE(SUM(pot_coins), 0) as total_coins_in_play,
                    COUNT(CASE WHEN is_company_mode = true THEN 1 END) as company_raffles
                FROM raffles
            `);

            const todayStats = await client.query(`
                SELECT 
                    COUNT(*) as created_today,
                    COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_today
                FROM raffles 
                WHERE DATE(created_at) = CURRENT_DATE
            `);

            return {
                ...stats.rows[0],
                ...todayStats.rows[0]
            };

        } finally {
            client.release();
        }
    }

    /**
     * Generar PDF para ganador (simulado)
     */
    async generateWinnerPDF(raffleId) {
        // En implementación real, usar librería como Puppeteer o PDFKit
        const pdfUrl = `https://api.mundoxyz.com/raffles/${raffleId}/winner-certificate.pdf`;
        
        // Aquí se generaría el PDF con:
        // - Datos de la rifa
        // - Información del ganador
        // - Código QR del ticket
        // - Datos legales y términos
        
        return pdfUrl;
    }

    /**
     * Configurar métodos de cobro para rifa modo premio
     */
    async setPaymentMethods(hostId, raffleId, methods) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar que el usuario sea el host
            const raffle = await client.query('SELECT host_id, mode FROM raffles WHERE id = $1', [raffleId]);
            if (!raffle.rows[0] || raffle.rows[0].host_id !== hostId) {
                throw new Error('No autorizado');
            }

            // Eliminar métodos existentes
            await client.query('DELETE FROM raffle_host_payment_methods WHERE raffle_id = $1', [raffleId]);

            // Insertar nuevos métodos
            for (const method of methods) {
                if (method.method_type === 'transferencia') {
                    await client.query(`
                        INSERT INTO raffle_host_payment_methods (
                            raffle_id, method_type, bank_name, account_holder, 
                            account_number, id_number, phone, instructions, is_active
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [raffleId, 'transferencia', method.bank_name, method.account_holder,
                        method.account_number, method.id_number, method.phone, 
                        method.instructions, method.is_active !== false]);
                } else if (method.method_type === 'efectivo') {
                    await client.query(`
                        INSERT INTO raffle_host_payment_methods (
                            raffle_id, method_type, pickup_instructions, is_active
                        ) VALUES ($1, $2, $3, $4)
                    `, [raffleId, 'efectivo', method.pickup_instructions, method.is_active !== false]);
                }
            }

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener métodos de cobro de una rifa
     */
    async getPaymentMethods(raffleId) {
        const result = await this.pool.query(`
            SELECT * FROM raffle_host_payment_methods 
            WHERE raffle_id = $1 AND is_active = true
            ORDER BY method_type
        `, [raffleId]);
        return result.rows;
    }

    /**
     * Obtener solicitudes pendientes de aprobación
     */
    async getPendingRequests(hostId, raffleId) {
        // Verificar que sea el host
        const raffle = await this.pool.query('SELECT host_id FROM raffles WHERE id = $1', [raffleId]);
        if (!raffle.rows[0] || raffle.rows[0].host_id !== hostId) {
            throw new Error('No autorizado');
        }

        const requests = await this.pool.query(`
            SELECT 
                rr.*,
                u.username,
                u.display_name
            FROM raffle_requests rr
            JOIN users u ON rr.user_id = u.id
            WHERE rr.raffle_id = $1 AND rr.status = 'pending'
            ORDER BY rr.created_at ASC
        `, [raffleId]);

        return requests.rows;
    }

    /**
     * Cancelar rifa con reembolso completo (admin/tote)
     * Incluye reembolso del creation_cost al host
     */
    async cancelRaffleWithRefund(adminId, raffleId, reason) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            // Verificar que sea admin o tote
            const adminCheck = await client.query(`
                SELECT r.name as role_name
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1 AND r.name IN ('admin', 'tote')
            `, [adminId]);
            
            if (adminCheck.rows.length === 0) {
                throw new Error('Requiere permisos de administrador o tote');
            }

            // Obtener rifa con información completa
            const raffle = await client.query('SELECT * FROM raffles WHERE id = $1', [raffleId]);
            if (!raffle.rows[0]) {
                throw new Error('Rifa no encontrada');
            }

            const raffleData = raffle.rows[0];
            if (raffleData.status === 'finished') {
                throw new Error('La rifa ya finalizó');
            }
            if (raffleData.status === 'cancelled') {
                throw new Error('La rifa ya está cancelada');
            }

            // Calcular platform_fee que pagó el host al crear la rifa
            // FIRES: pagó entry_price_fire (cost_per_number)
            // PRIZE normal: pagó 300
            // PRIZE empresa: pagó 3000
            const isCompanyMode = raffleData.is_company_mode;
            const platformFee = raffleData.mode === 'fires' 
                ? parseFloat(raffleData.entry_price_fire) || 0
                : (isCompanyMode ? 3000 : 300);

            // Obtener todos los números vendidos
            const soldNumbers = await client.query(`
                SELECT number_idx, owner_id FROM raffle_numbers 
                WHERE raffle_id = $1 AND state = 'sold'
            `, [raffleId]);

            const costPerNumber = parseFloat(raffleData.entry_price_fire) || 0;
            const totalRefundBuyers = costPerNumber * soldNumbers.rows.length;
            
            logger.info('🔄 Iniciando reembolso por cancelación', {
                raffleId,
                raffleCode: raffleData.code,
                totalBuyers: soldNumbers.rows.length,
                costPerNumber,
                totalRefundBuyers,
                potFires: raffleData.pot_fires,
                hostId: raffleData.host_id
            });

            // 1. DESCONTAR del HOST (que recibió el pot_fires)
            // Los fuegos de compras van al pot_fires, que el host recibe al finalizar
            // Al cancelar, el HOST debe devolver esos fuegos
            if (totalRefundBuyers > 0) {
                await client.query(`
                    UPDATE wallets 
                    SET fires_balance = fires_balance - $1 
                    WHERE user_id = $2
                `, [totalRefundBuyers, raffleData.host_id]);
                
                // Registrar transacción del host (devuelve lo recibido)
                await client.query(`
                    INSERT INTO wallet_transactions 
                    (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                    VALUES (
                        (SELECT id FROM wallets WHERE user_id = $1),
                        'raffle_refund_from_pot', 'fires', $2,
                        (SELECT fires_balance + $2 FROM wallets WHERE user_id = $1),
                        (SELECT fires_balance FROM wallets WHERE user_id = $1),
                        $3, $4
                    )
                `, [
                    raffleData.host_id, 
                    totalRefundBuyers, 
                    raffleData.code, 
                    `Devolución pot rifa cancelada ${raffleData.code} (${soldNumbers.rows.length} números)`
                ]);
                
                logger.info('💸 Host devuelve pot_fires para reembolso', {
                    hostId: raffleData.host_id,
                    amount: totalRefundBuyers
                });
            }

            // 2. Reembolsar a cada comprador
            for (const num of soldNumbers.rows) {
                await client.query(`
                    UPDATE wallets 
                    SET fires_balance = fires_balance + $1 
                    WHERE user_id = $2
                `, [costPerNumber, num.owner_id]);
                
                // Registrar transacción de reembolso para cada comprador
                await client.query(`
                    INSERT INTO wallet_transactions 
                    (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                    VALUES (
                        (SELECT id FROM wallets WHERE user_id = $1),
                        'raffle_number_refund', 'fires', $2,
                        (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
                        (SELECT fires_balance FROM wallets WHERE user_id = $1),
                        $3, $4
                    )
                `, [num.owner_id, costPerNumber, raffleData.code, `Reembolso número ${num.number_idx} - Rifa cancelada ${raffleData.code}`]);
            }

            // 3. Reembolsar platform_fee al host Y descontar del admin
            let refundedHostAmount = 0;
            if (platformFee > 0) {
                // 3.1. Buscar admin de plataforma
                const adminTgId = '1417856820';
                const adminUserCheck = await client.query(`
                    SELECT id FROM users WHERE tg_id = $1
                `, [adminTgId]);
                
                if (adminUserCheck.rows.length === 0) {
                    logger.warn('Admin de plataforma no encontrado - reembolso parcial sin descuento admin');
                } else {
                    const adminUserId = adminUserCheck.rows[0].id;
                    
                    // 3.2. Descontar del admin (devolver los fuegos que recibió al crear la rifa)
                    await client.query(`
                        UPDATE wallets 
                        SET fires_balance = fires_balance - $1 
                        WHERE user_id = $2
                    `, [platformFee, adminUserId]);
                    
                    // 3.3. Registrar transacción del admin (devuelve comisión)
                    await client.query(`
                        INSERT INTO wallet_transactions 
                        (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                        VALUES (
                            (SELECT id FROM wallets WHERE user_id = $1),
                            'raffle_refund_platform_fee', 'fires', $2,
                            (SELECT fires_balance + $2 FROM wallets WHERE user_id = $1),
                            (SELECT fires_balance FROM wallets WHERE user_id = $1),
                            $3, $4
                        )
                    `, [
                        adminUserId, 
                        platformFee, 
                        raffleData.code, 
                        `Devolución comisión rifa cancelada ${raffleData.code}`
                    ]);
                    
                    logger.info('💰 Platform fee descontado del admin', {
                        adminUserId,
                        platformFee,
                        raffleCode: raffleData.code
                    });
                }
                
                // 3.4. Acreditar al host (reembolso platform fee)
                await client.query(`
                    UPDATE wallets 
                    SET fires_balance = fires_balance + $1 
                    WHERE user_id = $2
                `, [platformFee, raffleData.host_id]);

                refundedHostAmount = platformFee;
                
                // 3.5. Registrar transacción de reembolso al host
                const refundDescription = raffleData.mode === 'fires'
                    ? `Reembolso creación rifa fuegos ${raffleData.code} (cancelada)`
                    : isCompanyMode
                        ? `Reembolso creación rifa premio empresa ${raffleData.code} (cancelada)`
                        : `Reembolso creación rifa premio ${raffleData.code} (cancelada)`;
                
                await client.query(`
                    INSERT INTO wallet_transactions 
                    (wallet_id, type, currency, amount, balance_before, balance_after, reference, description)
                    VALUES (
                        (SELECT id FROM wallets WHERE user_id = $1),
                        'raffle_creation_refund', 'fires', $2,
                        (SELECT fires_balance - $2 FROM wallets WHERE user_id = $1),
                        (SELECT fires_balance FROM wallets WHERE user_id = $1),
                        $3, $4
                    )
                `, [raffleData.host_id, platformFee, raffleData.code, refundDescription]);
            }

            // Marcar rifa como cancelada
            await client.query(`
                UPDATE raffles 
                SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP 
                WHERE id = $1
            `, [raffleId]);

            // Registrar en audit con detalles completos
            await client.query(`
                INSERT INTO raffle_audit_logs (raffle_id, action, admin_id, details)
                VALUES ($1, 'cancelled_with_refund', $2, $3)
            `, [raffleId, adminId, JSON.stringify({ 
                reason, 
                refunded_buyers: soldNumbers.rows.length,
                refunded_buyers_amount: totalRefundBuyers,
                refunded_host_amount: refundedHostAmount,
                total_refunded: totalRefundBuyers + refundedHostAmount
            })]);

            await client.query('COMMIT');

            logger.info('Rifa cancelada con reembolso completo', {
                raffleId,
                adminId,
                refundedBuyers: soldNumbers.rows.length,
                refundedBuyersAmount: totalRefundBuyers,
                refundedHostAmount: refundedHostAmount,
                totalRefunded: totalRefundBuyers + refundedHostAmount,
                reason
            });

            return { 
                success: true, 
                refunded_users: soldNumbers.rows.length,
                refunded_buyers_amount: totalRefundBuyers,
                refunded_host_amount: refundedHostAmount,
                total_refunded: totalRefundBuyers + refundedHostAmount
            };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Actualizar datos de pago de una rifa (Premio/Empresa)
     * Solo el anfitrión puede actualizar sus datos de pago
     */
    async updatePaymentDetails(raffleId, hostId, paymentData) {
        const client = await this.pool.connect();
        
        try {
            // Verificar que el usuario sea el anfitrión
            const raffleResult = await client.query(
                'SELECT host_id, mode FROM raffles WHERE id = $1',
                [raffleId]
            );

            if (raffleResult.rows.length === 0) {
                throw new Error('Rifa no encontrada');
            }

            const raffle = raffleResult.rows[0];

            if (raffle.host_id !== hostId) {
                throw new Error('Solo el anfitrión puede actualizar los datos de pago');
            }

            if (raffle.mode !== 'prize' && raffle.mode !== 'company') {
                throw new Error('Esta rifa no acepta pagos externos');
            }

            // Validar datos según método de pago
            const {
                payment_cost_amount,
                payment_cost_currency = 'USD',
                payment_method,
                payment_bank_code,
                payment_phone,
                payment_id_number,
                payment_instructions,
                allow_fire_payments = false
            } = paymentData;

            if (!payment_cost_amount || payment_cost_amount <= 0) {
                throw new Error('El costo de la rifa es requerido');
            }

            if (!payment_method || !['cash', 'bank'].includes(payment_method)) {
                throw new Error('Método de pago inválido');
            }

            // Validar instrucciones (máx 300 caracteres)
            if (payment_instructions && payment_instructions.length > 300) {
                throw new Error('Las instrucciones no pueden exceder 300 caracteres');
            }

            // Si es banco, validar campos obligatorios
            if (payment_method === 'bank') {
                if (!payment_bank_code || !payment_phone || !payment_id_number) {
                    throw new Error('Para pago móvil se requieren: banco, teléfono y cédula');
                }
            }

            // Actualizar datos
            const updateResult = await client.query(`
                UPDATE raffles 
                SET 
                    payment_cost_amount = $1,
                    payment_cost_currency = $2,
                    payment_method = $3,
                    payment_bank_code = $4,
                    payment_phone = $5,
                    payment_id_number = $6,
                    payment_instructions = $7,
                    allow_fire_payments = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING 
                    payment_cost_amount,
                    payment_cost_currency,
                    payment_method,
                    payment_bank_code,
                    payment_phone,
                    payment_id_number,
                    payment_instructions,
                    allow_fire_payments
            `, [
                payment_cost_amount,
                payment_cost_currency,
                payment_method,
                payment_method === 'bank' ? payment_bank_code : null,
                payment_method === 'bank' ? payment_phone : null,
                payment_method === 'bank' ? payment_id_number : null,
                payment_instructions || null,
                allow_fire_payments,
                raffleId
            ]);

            logger.info('Datos de pago actualizados', {
                raffleId,
                hostId,
                payment_method
            });

            return updateResult.rows[0];

        } catch (error) {
            logger.error('Error actualizando datos de pago:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener datos de pago de una rifa
     * Datos sensibles solo visibles para host y compradores
     */
    async getPaymentDetails(raffleId, userId = null) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT 
                    id,
                    host_id,
                    mode,
                    payment_cost_amount,
                    payment_cost_currency,
                    payment_method,
                    payment_bank_code,
                    payment_phone,
                    payment_id_number,
                    payment_instructions,
                    allow_fire_payments
                FROM raffles 
                WHERE id = $1
            `, [raffleId]);

            if (result.rows.length === 0) {
                throw new Error('Rifa no encontrada');
            }

            const raffle = result.rows[0];

            // Si no hay método de pago configurado
            if (!raffle.payment_method) {
                return null;
            }

            // Datos públicos (siempre visibles)
            const publicData = {
                payment_cost_amount: raffle.payment_cost_amount,
                payment_cost_currency: raffle.payment_cost_currency,
                payment_method: raffle.payment_method,
                payment_instructions: raffle.payment_instructions,
                allow_fire_payments: raffle.allow_fire_payments || false
            };

            // Datos sensibles (solo para host y compradores autenticados)
            if (raffle.payment_method === 'bank') {
                publicData.payment_bank_code = raffle.payment_bank_code;
                publicData.payment_phone = raffle.payment_phone;
                publicData.payment_id_number = raffle.payment_id_number;
            }

            return publicData;

        } catch (error) {
            logger.error('Error obteniendo datos de pago:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener lista de participantes con nombres públicos
     * Solo muestra display_name y números comprados
     */
    async getParticipants(raffleId) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT 
                    rr.id,
                    rr.request_data,
                    rr.buyer_profile,
                    rr.status,
                    rr.created_at
                FROM raffle_requests rr
                WHERE rr.raffle_id = $1 
                  AND rr.status = 'approved'
                ORDER BY rr.created_at ASC
            `, [raffleId]);

            // Agrupar por nombre y números
            const participants = {};

            result.rows.forEach(row => {
                const buyerProfile = row.buyer_profile || {};
                const displayName = buyerProfile.display_name || 'Anónimo';
                const numberIdx = row.request_data?.number_idx;

                if (!participants[displayName]) {
                    participants[displayName] = {
                        display_name: displayName,
                        numbers: []
                    };
                }

                if (numberIdx !== undefined) {
                    participants[displayName].numbers.push(numberIdx);
                }
            });

            // Convertir a array y ordenar números
            return Object.values(participants).map(p => ({
                ...p,
                numbers: p.numbers.sort((a, b) => a - b)
            }));

        } catch (error) {
            logger.error('Error obteniendo participantes:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener datos completos de un participante
     * Solo accesible por: Admin, Tote, o Host (solo para el ganador)
     */
    async getParticipantFullData(raffleId, participantRequestId, requesterId) {
        const client = await this.pool.connect();
        
        try {
            // Obtener información de la rifa
            const raffleResult = await client.query(`
                SELECT host_id, winner_id FROM raffles WHERE id = $1
            `, [raffleId]);

            if (raffleResult.rows.length === 0) {
                throw new Error('Rifa no encontrada');
            }

            const raffle = raffleResult.rows[0];

            // Obtener roles del solicitante
            const rolesResult = await client.query(`
                SELECT r.name
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1
            `, [requesterId]);

            const roles = rolesResult.rows.map(r => r.name);
            const isAdmin = roles.includes('admin') || roles.includes('tote');
            const isHost = raffle.host_id === requesterId;

            // Obtener solicitud del participante
            const requestResult = await client.query(`
                SELECT 
                    rr.id,
                    rr.user_id,
                    rr.buyer_profile,
                    rr.request_data,
                    rr.payment_reference
                FROM raffle_requests rr
                WHERE rr.id = $1 AND rr.raffle_id = $2
            `, [participantRequestId, raffleId]);

            if (requestResult.rows.length === 0) {
                throw new Error('Solicitud no encontrada');
            }

            const request = requestResult.rows[0];

            // Verificar permisos
            const isWinner = request.user_id === raffle.winner_id;

            if (!isAdmin && !(isHost && isWinner)) {
                throw new Error('Acceso denegado: solo puedes ver datos completos del ganador');
            }

            // Retornar datos completos
            return {
                ...request.buyer_profile,
                payment_reference: request.payment_reference,
                number_idx: request.request_data?.number_idx
            };

        } catch (error) {
            logger.error('Error obteniendo datos completos de participante:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = RaffleService;
