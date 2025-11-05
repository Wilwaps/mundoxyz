/**
 * ENDPOINTS CORREGIDOS PARA IMÁGENES DE RIFAS
 * Almacena imágenes en PostgreSQL como Base64 (sin AWS S3)
 * 
 * INSTRUCCIONES:
 * 1. En raffles.js, buscar y ELIMINAR las líneas que contengan:
 *    - const AWS = require('aws-sdk');
 *    - const s3 = new AWS.S3({...});
 * 
 * 2. Buscar y REEMPLAZAR los 2 endpoints de upload con estos:
 *    - /upload-logo
 *    - /upload-prize-image
 * 
 * 3. Si hay código duplicado, eliminar las duplicaciones
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');

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

module.exports = router;
