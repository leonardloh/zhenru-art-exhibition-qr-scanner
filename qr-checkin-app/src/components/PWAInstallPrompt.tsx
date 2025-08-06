'use client';

import React, { useState, useEffect } from 'react';
import { pwaInstallManager, isStandalone } from '@/lib/pwa-utils';

interface PWAInstallPromptProps {
  onInstall?: () => void;
  onDismiss?: () => void;
}

export default function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isStandalone() || isDismissed) {
      return;
    }

    const unsubscribe = pwaInstallManager.onInstallAvailable((available) => {
      setCanInstall(available);
    });

    return unsubscribe;
  }, [isDismissed]);

  const handleInstall = async () => {
    if (!canInstall || isInstalling) return;

    setIsInstalling(true);
    
    try {
      const installed = await pwaInstallManager.install();
      
      if (installed) {
        onInstall?.();
        setCanInstall(false);
      }
    } catch (error) {
      console.error('Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setCanInstall(false);
    onDismiss?.();
  };

  // Don't render if can't install, already dismissed, or already standalone
  if (!canInstall || isDismissed || isStandalone()) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          {/* App Icon */}
          <div className="flex-shrink-0">
            <img 
              src="/icons/icon-72x72.png" 
              alt="QR Check-in App" 
              className="w-12 h-12 rounded-lg"
            />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Install QR Check-in App
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Add to your home screen for quick access and offline functionality
            </p>
            
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors duration-200"
              >
                {isInstalling ? (
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    Installing...
                  </div>
                ) : (
                  'Install'
                )}
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Not now
              </button>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
            aria-label="Dismiss install prompt"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}