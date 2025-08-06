'use client';

import { useEffect } from 'react';
import { initializePWA } from '@/lib/pwa-utils';

export default function PWAInitializer() {
  useEffect(() => {
    // Initialize PWA features on client side
    initializePWA();
  }, []);

  // This component doesn't render anything
  return null;
}