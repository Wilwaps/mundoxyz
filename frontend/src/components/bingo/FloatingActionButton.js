import React from 'react';
import { motion } from 'framer-motion';

const FloatingActionButton = ({ icon: Icon, onClick, label, className = '' }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`
        fixed bottom-24 right-6 z-40
        w-14 h-14 
        rounded-full 
        glass-effect
        flex items-center justify-center
        shadow-2xl shadow-purple-500/50
        hover:shadow-purple-400/70
        transition-all duration-300
        ${className}
      `}
      aria-label={label}
    >
      <Icon className="text-2xl text-white" />
      {label && (
        <span className="sr-only">{label}</span>
      )}
    </motion.button>
  );
};

export default FloatingActionButton;
