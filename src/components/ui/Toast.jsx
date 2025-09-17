// src/components/ui/Toast.jsx
import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getBackgroundColor = () => {
    switch(type) {
      case 'join': return 'bg-green-500';
      case 'rejoin': return 'bg-blue-500';
      case 'leave': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getIcon = () => {
    switch(type) {
      case 'join': return '👋';
      case 'rejoin': return '🔄';
      case 'leave': return '👋';
      case 'error': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className={`${getBackgroundColor()} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in`}>
      <span className="text-xl">{getIcon()}</span>
      <p className="flex-1">{message}</p>
      <button 
        onClick={onClose}
        className="text-white/80 hover:text-white text-xl"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;