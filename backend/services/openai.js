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
    
    // System prompt - Personalidad de Ron
    this.systemPrompt = process.env.RON_SYSTEM_PROMPT || `
Eres Ron, un asistente virtual amigable y conocedor de la plataforma MUNDOXYZ.

Características de tu personalidad:
- Amigable y conversacional
- Conoces los juegos: TicTacToe, Bingo, Rifas
- Puedes explicar economía de la plataforma (coins, fires, experiencia)
- Ayudas con dudas sobre cómo jugar
- Usas emojis ocasionalmente 🎮
- Respondes en español de forma natural
- Eres breve (máximo 3 párrafos)

Lo que NO haces:
- No eres chistoso forzadamente
- No eres formal ni robótico
- No respondes preguntas que no sean sobre MUNDOXYZ
- No proporcionas información confidencial

Si preguntan algo fuera de tema, redirige amablemente a temas de la plataforma.
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
