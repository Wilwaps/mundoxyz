/**
 * OpenAI Service
 * Maneja comunicación con OpenAI API y almacenamiento de conversaciones en archivos JSON
 */

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class OpenAIService {
  constructor() {
    // Inicializar cliente OpenAI
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Configuración
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500');
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
    
    // System prompt - Personalidad de Ron (orientado 100% al jugador)
    this.systemPrompt = process.env.RON_SYSTEM_PROMPT || `
Eres Ron, el asistente oficial de MundoXYZ.

TU MISIÓN
- Ayudar al jugador que te habla a entender y usar MundoXYZ.
- Explicar con claridad cómo jugar, cómo recargar y usar sus fuegos 🔥 y monedas 💰, y cómo moverse por la plataforma.
- Siempre hablas como si fueras un guía dentro de la app, no como un programador.

PRIVACIDAD Y DATOS
- Solo puedes usar y mencionar información del usuario actual (la persona que te escribe).
- Puedes hablar de su propio perfil, experiencia (XP), victorias y derrotas, rifas compradas, salas activas, historial y balances.
- Nunca des información concreta de otros jugadores (nombres, estadísticas, saldos, historial, correos, etc.).
- Si te piden datos de otras personas, responde que por privacidad no puedes compartir esa información.

ESTILO Y TONO
- Escribe siempre en español y de forma cercana, usando "tú".
- Sé claro, directo y amable. Evita párrafos muy largos.
- Usa listas y pasos numerados cuando expliques procesos (por ejemplo, 1, 2, 3...).
- Puedes usar algunos emojis relacionados con el juego o la economía (🎮, 💰, 🔥), pero sin abusar.
- Evita sonar técnico, robótico o excesivamente formal.

QUÉ PUEDES EXPLICAR (VISTA DE JUGADOR)
- Cómo ver y entender su perfil, experiencia (XP) y progresos.
- Cómo ver su balance de monedas y fuegos, y qué significa cada uno:
  - Monedas 💰: puntos suaves para jugar y progresar.
  - Fuegos 🔥: moneda valiosa que se usa para entrar a juegos, rifas y experiencias, y luego se puede canjear por dinero.
- Cómo depositar fuegos:
  - Explica el flujo típico en la app (ir a Perfil, entrar en la tarjeta de fuegos, usar la opción de comprar/recargar, seguir las instrucciones en pantalla y esperar aprobación).
- Cómo enviar y recibir fuegos:
  - Enviar: ir a la sección de fuegos, elegir Enviar/Transferir, seleccionar a quién enviar y cuánto, y confirmar.
  - Recibir: ir a la opción Recibir, copiar o mostrar su dirección/QR y compartirla con quien le va a enviar fuegos.
- Cómo entrar a salas y partidas desde el Lobby:
  - Ver sus salas activas.
  - Usar "Unirse rápido" con un código de 6 dígitos.
  - Crear o entrar a salas de TicTacToe, Bingo o Rifas.
- Cómo funciona cada tipo de juego a nivel usuario (sin detalles técnicos):
  - TicTacToe (La Vieja) como juego 1 vs 1 con apuesta y premio.
  - Bingo como partida con cartones, números que se cantan y patrones ganadores.
  - Rifas donde compra números y se elige un ganador en un sorteo.

LIMITES IMPORTANTES
- No expliques detalles técnicos del sistema (nada de bases de datos, APIs, endpoints, servidores, sockets, tokens, tablas, etc.).
- No hables del código ni de la infraestructura interna de MundoXYZ.
- Si el usuario pregunta por temas técnicos, responde que eres un asistente pensado para jugadores y que puedes ayudarle a entender cómo usar la plataforma, no cómo está programada.
- No inventes reglas, montos ni políticas de pagos si no estás seguro. Si algo puede variar, dilo claramente (por ejemplo: "esta información puede cambiar, revisa siempre lo que ves en pantalla o contacta soporte").

CÓMO RESPONDER
- Primero identifica qué quiere el jugador (por ejemplo: aprender a jugar, depositar, retirar, entender su saldo, etc.).
- Cuando des instrucciones, usa pasos claros:
  - 1) abre el Lobby,
  - 2) entra a Perfil,
  - 3) toca la tarjeta de Fuegos, etc.
- Si el usuario pide muchas cosas a la vez, puedes sugerir ir paso a paso.
- Si el usuario pide algo que no puedes hacer (modificar saldos, cambiar resultados, ver datos de otros), explícalo con respeto y ofrece alternativas si existen.

EN RESUMEN
- Habla siempre como un guía dentro de MundoXYZ.
- Ayuda solo al jugador actual usando su propia información.
- Mantén la conversación en temas de MundoXYZ y su uso como jugador.
    `.trim();
    
    // Directorio para almacenar conversaciones
    this.storageDir = path.join(__dirname, '../data/ron_chats');
    this.initStorage();
    
    logger.info('🤖 OpenAI Service inicializado', {
      model: this.model,
      maxTokens: this.maxTokens,
      storageDir: this.storageDir
    });
  }
  
  /**
   * Inicializar directorio de almacenamiento
   */
  async initStorage() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      logger.info('📁 Ron chats storage directory initialized');
    } catch (error) {
      logger.error('❌ Error creating storage directory', { error: error.message });
    }
  }
  
  /**
   * Obtener ruta del archivo de conversación de un usuario
   */
  getUserChatPath(userId) {
    return path.join(this.storageDir, `${userId}.json`);
  }
  
  /**
   * Cargar historial de conversación de un usuario
   */
  async loadUserHistory(userId) {
    try {
      const chatPath = this.getUserChatPath(userId);
      const data = await fs.readFile(chatPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // Si el archivo no existe, retornar array vacío
      if (error.code === 'ENOENT') {
        return [];
      }
      logger.error('❌ Error loading user chat history', {
        userId,
        error: error.message
      });
      return [];
    }
  }
  
  /**
   * Guardar historial de conversación de un usuario
   */
  async saveUserHistory(userId, messages) {
    try {
      const chatPath = this.getUserChatPath(userId);
      await fs.writeFile(chatPath, JSON.stringify(messages, null, 2), 'utf-8');
      logger.info('💾 User chat history saved', {
        userId,
        messageCount: messages.length
      });
    } catch (error) {
      logger.error('❌ Error saving user chat history', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Agregar mensaje al historial de un usuario
   */
  async addMessage(userId, username, message, isBot = false) {
    try {
      const history = await this.loadUserHistory(userId);
      
      const newMessage = {
        role: isBot ? 'assistant' : 'user',
        content: message,
        username: isBot ? 'Ron' : username,
        timestamp: new Date().toISOString()
      };
      
      history.push(newMessage);
      
      // Limitar historial a últimos 50 mensajes para no ocupar mucho espacio
      const limitedHistory = history.slice(-50);
      
      await this.saveUserHistory(userId, limitedHistory);
      
      return newMessage;
    } catch (error) {
      logger.error('❌ Error adding message to history', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Limpiar historial de conversación de un usuario
   */
  async clearUserHistory(userId) {
    try {
      const chatPath = this.getUserChatPath(userId);
      await fs.unlink(chatPath);
      logger.info('🗑️ User chat history cleared', { userId });
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Archivo no existe, ya está "limpio"
        return true;
      }
      logger.error('❌ Error clearing user chat history', {
        userId,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * Formatear historial para OpenAI API
   * Convierte el historial guardado en el formato que espera OpenAI
   */
  formatHistoryForOpenAI(history, includeSystemPrompt = true) {
    const messages = [];
    
    // Agregar system prompt al inicio
    if (includeSystemPrompt) {
      messages.push({
        role: 'system',
        content: this.systemPrompt
      });
    }
    
    // Agregar mensajes del historial
    // Limitar a últimos 10 mensajes para no exceder tokens
    const recentHistory = history.slice(-10);
    
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }
    
    return messages;
  }
  
  /**
   * Obtener respuesta de OpenAI
   */
  async chat(userId, userMessage) {
    try {
      // Cargar historial del usuario
      const history = await this.loadUserHistory(userId);
      
      // Agregar mensaje del usuario al historial
      history.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      });
      
      // Formatear para OpenAI
      const messages = this.formatHistoryForOpenAI(history);
      
      logger.info('🤖 Sending request to OpenAI', {
        userId,
        model: this.model,
        messagesCount: messages.length,
        userMessage: userMessage.substring(0, 50)
      });
      
      // Llamar OpenAI API
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });
      
      const botResponse = completion.choices[0].message.content;
      
      logger.info('✅ OpenAI response received', {
        userId,
        responseLength: botResponse.length,
        tokensUsed: completion.usage.total_tokens
      });
      
      // Agregar respuesta del bot al historial
      history.push({
        role: 'assistant',
        content: botResponse,
        timestamp: new Date().toISOString()
      });
      
      // Guardar historial actualizado
      await this.saveUserHistory(userId, history);
      
      return {
        success: true,
        message: botResponse,
        tokensUsed: completion.usage.total_tokens
      };
      
    } catch (error) {
      logger.error('❌ Error in OpenAI chat', {
        userId,
        error: error.message,
        code: error.code
      });
      
      // Manejar errores específicos de OpenAI
      if (error.code === 'insufficient_quota') {
        return {
          success: false,
          error: 'Lo siento, el servicio está temporalmente no disponible. Por favor intenta más tarde.'
        };
      }
      
      if (error.code === 'rate_limit_exceeded') {
        return {
          success: false,
          error: 'Demasiadas solicitudes. Por favor espera un momento e intenta de nuevo.'
        };
      }
      
      if (error.code === 'invalid_api_key') {
        return {
          success: false,
          error: 'Error de configuración del servicio. Por favor contacta al soporte.'
        };
      }
      
      // Error genérico
      return {
        success: false,
        error: 'Ocurrió un error al procesar tu mensaje. Por favor intenta nuevamente.'
      };
    }
  }
  
  /**
   * Obtener estadísticas de uso de un usuario
   */
  async getUserStats(userId) {
    try {
      const history = await this.loadUserHistory(userId);
      
      const userMessages = history.filter(m => m.role === 'user').length;
      const botMessages = history.filter(m => m.role === 'assistant').length;
      
      return {
        totalMessages: history.length,
        userMessages,
        botMessages,
        firstMessage: history[0]?.timestamp || null,
        lastMessage: history[history.length - 1]?.timestamp || null
      };
    } catch (error) {
      logger.error('❌ Error getting user stats', {
        userId,
        error: error.message
      });
      return null;
    }
  }
}

// Exportar instancia única (singleton)
module.exports = new OpenAIService();
