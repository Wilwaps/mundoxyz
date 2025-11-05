# Script para limpiar raffles.js correctamente
$inputFile = "backend\routes\raffles.js"
$outputFile = "backend\routes\raffles_fixed.js"

# Leer todas las líneas
$lines = Get-Content $inputFile

# Crear array nuevo eliminando líneas 605-845 (duplicadas)
$newLines = @()
$newLines += $lines[0..604]   # Líneas 1-605
$newLines += $lines[846..($lines.Count-1)]  # Líneas 847 al final

# Ahora reemplazar los endpoints de AWS por Base64
$content = $newLines -join "`n"

# Reemplazar primer endpoint upload-logo
$oldLogo = @'
/**
 * POST /api/raffles/upload-logo
 * Subir logo para modo empresa (AWS S3)
 */
router.post('/upload-logo', verifyToken, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen'
            });
        }

        const fileName = `raffle-logos/${Date.now()}-${req.file.originalname}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(params).promise();
        
        res.json({
            success: true,
            data: {
                logo_url: uploadResult.Location
            },
            message: 'Logo subido exitosamente'
        });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
'@

$newLogo = @'
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
'@

$content = $content -replace [regex]::Escape($oldLogo), $newLogo

# Reemplazar endpoint upload-prize-image
$oldPrize = @'
/**
 * POST /api/raffles/upload-prize-image
 * Subir imagen del premio (AWS S3)
 */
router.post('/upload-prize-image', verifyToken, upload.single('prize_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionó archivo de imagen del premio'
            });
        }

        const fileName = `raffle-prizes/${Date.now()}-${req.file.originalname}`;
        
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: fileName,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read'
        };

        const uploadResult = await s3.upload(params).promise();
        
        res.json({
            success: true,
            data: {
                image_url: uploadResult.Location
            },
            message: 'Imagen del premio subida exitosamente'
        });
    } catch (error) {
        console.error('Error uploading prize image:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
'@

$newPrize = @'
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
'@

$content = $content -replace [regex]::Escape($oldPrize), $newPrize

# Escribir archivo arreglado
$content | Set-Content $outputFile

Write-Host "✅ Archivo arreglado exitosamente"
Write-Host "Original: $($lines.Count) líneas"
Write-Host "Nuevo: $(($content -split "`n").Count) líneas (aprox)"
Write-Host "Eliminadas: $(($lines.Count) - 846 + 605) líneas duplicadas"
