const { query, transaction } = require('../db');
const logger = require('../utils/logger');

/**
 * Servicio para gestión de roles de usuarios
 * Solo accesible por usuarios con rol 'tote'
 */
class RoleService {
  
  /**
   * Obtener roles disponibles en el sistema
   */
  async getAvailableRoles() {
    try {
      const result = await query(
        `SELECT id, name, description 
         FROM roles 
         ORDER BY 
           CASE name 
             WHEN 'tote' THEN 1 
             WHEN 'admin' THEN 2 
             WHEN 'moderator' THEN 3
             ELSE 4 
           END,
           name`
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting available roles:', error);
      throw new Error('Error al obtener roles disponibles');
    }
  }

  /**
   * Obtener roles actuales de un usuario
   */
  async getUserRoles(userId) {
    try {
      const result = await query(
        `SELECT r.id, r.name, r.description
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1
         ORDER BY r.name`,
        [userId]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting user roles:', error);
      throw new Error('Error al obtener roles del usuario');
    }
  }

  /**
   * Actualizar roles de un usuario
   * @param {string} toteUserId - ID del usuario tote que realiza el cambio
   * @param {string} targetUserId - ID del usuario objetivo
   * @param {string[]} newRoles - Array de nombres de roles a asignar
   * @param {object} metadata - IP, user_agent, reason
   */
  async updateUserRoles(toteUserId, targetUserId, newRoles, metadata = {}) {
    return await transaction(async (client) => {
      try {
        // 1. Validar que el usuario tote no se quite el rol tote a sí mismo
        if (toteUserId === targetUserId && !newRoles.includes('tote')) {
          throw new Error('No puedes quitarte el rol tote a ti mismo');
        }

        // 2. Obtener roles actuales del usuario
        const currentRolesResult = await client.query(
          `SELECT r.name 
           FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1`,
          [targetUserId]
        );
        
        const currentRoles = currentRolesResult.rows.map(r => r.name);

        // 3. Validar que los nuevos roles existen
        const rolesResult = await client.query(
          `SELECT id, name FROM roles WHERE name = ANY($1)`,
          [newRoles]
        );
        
        if (rolesResult.rows.length !== newRoles.length) {
          const foundRoles = rolesResult.rows.map(r => r.name);
          const missingRoles = newRoles.filter(r => !foundRoles.includes(r));
          throw new Error(`Roles no válidos: ${missingRoles.join(', ')}`);
        }

        // 4. Determinar cambios
        const rolesToAdd = newRoles.filter(r => !currentRoles.includes(r));
        const rolesToRemove = currentRoles.filter(r => !newRoles.includes(r));

        // 5. Eliminar roles antiguos
        if (rolesToRemove.length > 0) {
          await client.query(
            `DELETE FROM user_roles 
             WHERE user_id = $1 
             AND role_id IN (
               SELECT id FROM roles WHERE name = ANY($2)
             )`,
            [targetUserId, rolesToRemove]
          );
        }

        // 6. Agregar roles nuevos
        if (rolesToAdd.length > 0) {
          const roleIds = rolesResult.rows
            .filter(r => rolesToAdd.includes(r.name))
            .map(r => r.id);
          
          const values = roleIds.map((roleId, idx) => 
            `($1, $${idx + 2})`
          ).join(', ');
          
          await client.query(
            `INSERT INTO user_roles (user_id, role_id) 
             VALUES ${values}
             ON CONFLICT (user_id, role_id) DO NOTHING`,
            [targetUserId, ...roleIds]
          );
        }

        // 7. Registrar cambios en auditoría
        for (const role of rolesToAdd) {
          await client.query(
            `INSERT INTO role_change_logs 
             (target_user_id, changed_by_user_id, action, role_name, 
              previous_roles, new_roles, reason, ip_address, user_agent)
             VALUES ($1, $2, 'add', $3, $4, $5, $6, $7, $8)`,
            [
              targetUserId,
              toteUserId,
              role,
              JSON.stringify(currentRoles),
              JSON.stringify(newRoles),
              metadata.reason || null,
              metadata.ip || null,
              metadata.userAgent || null
            ]
          );
        }

        for (const role of rolesToRemove) {
          await client.query(
            `INSERT INTO role_change_logs 
             (target_user_id, changed_by_user_id, action, role_name, 
              previous_roles, new_roles, reason, ip_address, user_agent)
             VALUES ($1, $2, 'remove', $3, $4, $5, $6, $7, $8)`,
            [
              targetUserId,
              toteUserId,
              role,
              JSON.stringify(currentRoles),
              JSON.stringify(newRoles),
              metadata.reason || null,
              metadata.ip || null,
              metadata.userAgent || null
            ]
          );
        }

        // 8. Obtener y retornar roles finales
        const finalRolesResult = await client.query(
          `SELECT r.id, r.name, r.description
           FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1
           ORDER BY r.name`,
          [targetUserId]
        );

        return {
          success: true,
          userId: targetUserId,
          previousRoles: currentRoles,
          currentRoles: finalRolesResult.rows.map(r => r.name),
          rolesAdded: rolesToAdd,
          rolesRemoved: rolesToRemove,
          changes: rolesToAdd.length + rolesToRemove.length
        };

      } catch (error) {
        logger.error('Error updating user roles:', error);
        throw error;
      }
    });
  }

  /**
   * Obtener historial de cambios de roles de un usuario
   */
  async getRoleChangeHistory(userId, limit = 50) {
    try {
      const result = await query(
        `SELECT 
           rcl.*,
           u_target.username as target_username,
           u_target.display_name as target_display_name,
           u_changer.username as changed_by_username,
           u_changer.display_name as changed_by_display_name
         FROM role_change_logs rcl
         JOIN users u_target ON rcl.target_user_id = u_target.id
         LEFT JOIN users u_changer ON rcl.changed_by_user_id = u_changer.id
         WHERE rcl.target_user_id = $1
         ORDER BY rcl.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting role change history:', error);
      throw new Error('Error al obtener historial de cambios');
    }
  }

  /**
   * Obtener todos los cambios de roles recientes (para tote)
   */
  async getAllRoleChanges(limit = 100) {
    try {
      const result = await query(
        `SELECT 
           rcl.*,
           u_target.username as target_username,
           u_target.display_name as target_display_name,
           u_changer.username as changed_by_username,
           u_changer.display_name as changed_by_display_name
         FROM role_change_logs rcl
         JOIN users u_target ON rcl.target_user_id = u_target.id
         LEFT JOIN users u_changer ON rcl.changed_by_user_id = u_changer.id
         ORDER BY rcl.created_at DESC
         LIMIT $1`,
        [limit]
      );
      
      return result.rows;
    } catch (error) {
      logger.error('Error getting all role changes:', error);
      throw new Error('Error al obtener historial de cambios');
    }
  }

  /**
   * Verificar si un usuario tiene un rol específico
   */
  async hasRole(userId, roleName) {
    try {
      const result = await query(
        `SELECT EXISTS (
           SELECT 1 FROM user_roles ur
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1 AND r.name = $2
         ) as has_role`,
        [userId, roleName]
      );
      
      return result.rows[0].has_role;
    } catch (error) {
      logger.error('Error checking user role:', error);
      return false;
    }
  }
}

module.exports = new RoleService();
