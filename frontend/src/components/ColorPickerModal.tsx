/**
 * Modal para seleccionar colores personalizados
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Droplet } from 'lucide-react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onColorSelect: (color: string) => void;
  initialColor?: string;
}

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  isOpen,
  onClose,
  onColorSelect,
  initialColor = '#FF0000'
}) => {
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [hexInput, setHexInput] = useState(initialColor);

  // Colores predefinidos populares
  const presetColors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
    '#F4A460', '#98D8C8', '#FDA7DF', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#E76F51', '#8E44AD', '#3498DB', '#E74C3C',
    '#1ABC9C', '#F39C12', '#D35400', '#C0392B', '#27AE60', '#2980B9',
    '#8E44AD', '#2C3E50', '#7F8C8D', '#BDC3C7', '#ECF0F1', '#FFFFFF'
  ];

  const handleHexChange = (value: string) => {
    setHexInput(value);
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      setSelectedColor(value);
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setHexInput(color);
  };

  const handleConfirm = () => {
    onColorSelect(selectedColor);
    onClose();
  };

  const isValidHex = /^#[0-9A-F]{6}$/i.test(hexInput);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md bg-dark border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Droplet size={20} className="text-accent" />
              Seleccionar Color
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-glass hover:bg-glass-hover flex items-center justify-center text-white/80"
            >
              <X size={18} />
            </button>
          </div>

          {/* Preview */}
          <div className="mb-6">
            <div className="text-sm text-white/60 mb-2">Vista previa</div>
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-lg border-2 border-white/20"
                style={{ backgroundColor: selectedColor }}
              />
              <div>
                <div className="text-white font-mono text-lg">{selectedColor}</div>
                <div className="text-white/60 text-sm">Color seleccionado</div>
              </div>
            </div>
          </div>

          {/* Hex Input */}
          <div className="mb-6">
            <label className="block text-sm text-white/60 mb-2">
              Código HEX
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value.toUpperCase())}
                placeholder="#FF0000"
                className="flex-1 bg-glass border border-white/10 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                maxLength={7}
              />
              <div
                className="w-10 h-10 rounded border-2 border-white/20"
                style={{ backgroundColor: hexInput }}
              />
            </div>
            {!isValidHex && hexInput.length > 0 && (
              <div className="text-xs text-red-400 mt-1">
                Formato inválido. Usa #RRGGBB (ej: #FF0000)
              </div>
            )}
          </div>

          {/* Preset Colors */}
          <div className="mb-6">
            <div className="text-sm text-white/60 mb-3">Colores populares</div>
            <div className="grid grid-cols-6 gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    selectedColor === color
                      ? 'border-accent scale-110'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValidHex}
              className="flex-1 py-3 rounded-lg bg-accent text-dark font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Seleccionar Color
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ColorPickerModal;
