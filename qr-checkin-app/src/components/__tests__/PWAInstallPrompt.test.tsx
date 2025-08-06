/**
 * PWA Install Prompt Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PWAInstallPrompt from '../PWAInstallPrompt';
import * as pwaUtils from '@/lib/pwa-utils';

// Mock PWA utilities
vi.mock('@/lib/pwa-utils', () => ({
  pwaInstallManager: {
    onInstallAvailable: vi.fn(),
    install: vi.fn(),
  },
  isStandalone: vi.fn(),
}));

describe('PWAInstallPrompt', () => {
  const mockOnInstallAvailable = vi.mocked(pwaUtils.pwaInstallManager.onInstallAvailable);
  const mockInstall = vi.mocked(pwaUtils.pwaInstallManager.install);
  const mockIsStandalone = vi.mocked(pwaUtils.isStandalone);

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsStandalone.mockReturnValue(false);
    mockOnInstallAvailable.mockImplementation((callback) => {
      // Immediately call callback with true to show install prompt
      callback(true);
      // Return unsubscribe function
      return () => {};
    });
  });

  it('should render install prompt when installation is available', () => {
    render(<PWAInstallPrompt />);

    expect(screen.getByText('Install QR Check-in App')).toBeInTheDocument();
    expect(screen.getByText('Add to your home screen for quick access and offline functionality')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });

  it('should not render when app is already standalone', () => {
    mockIsStandalone.mockReturnValue(true);

    render(<PWAInstallPrompt />);

    expect(screen.queryByText('Install QR Check-in App')).not.toBeInTheDocument();
  });

  it('should not render when installation is not available', () => {
    mockOnInstallAvailable.mockImplementation((callback) => {
      callback(false);
      return () => {};
    });

    render(<PWAInstallPrompt />);

    expect(screen.queryByText('Install QR Check-in App')).not.toBeInTheDocument();
  });

  it('should handle install button click', async () => {
    const onInstall = vi.fn();
    mockInstall.mockResolvedValue(true);

    render(<PWAInstallPrompt onInstall={onInstall} />);

    const installButton = screen.getByRole('button', { name: 'Install' });
    fireEvent.click(installButton);

    expect(screen.getByText('Installing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInstall).toHaveBeenCalled();
      expect(onInstall).toHaveBeenCalled();
    });
  });

  it('should handle install failure', async () => {
    mockInstall.mockRejectedValue(new Error('Install failed'));

    render(<PWAInstallPrompt />);

    const installButton = screen.getByRole('button', { name: 'Install' });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(mockInstall).toHaveBeenCalled();
      // Should show install button again after failure
      expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
    });
  });

  it('should handle dismiss button click', () => {
    const onDismiss = vi.fn();

    render(<PWAInstallPrompt onDismiss={onDismiss} />);

    const dismissButton = screen.getByRole('button', { name: 'Not now' });
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('should handle close button click', () => {
    const onDismiss = vi.fn();

    render(<PWAInstallPrompt onDismiss={onDismiss} />);

    const closeButton = screen.getByRole('button', { name: 'Dismiss install prompt' });
    fireEvent.click(closeButton);

    expect(onDismiss).toHaveBeenCalled();
  });

  it('should show app icon', () => {
    render(<PWAInstallPrompt />);

    const appIcon = screen.getByAltText('QR Check-in App');
    expect(appIcon).toBeInTheDocument();
    expect(appIcon).toHaveAttribute('src', '/icons/icon-72x72.png');
  });

  it('should disable install button during installation', async () => {
    mockInstall.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 100)));

    render(<PWAInstallPrompt />);

    const installButton = screen.getByRole('button', { name: 'Install' });
    fireEvent.click(installButton);

    expect(installButton).toBeDisabled();
    expect(screen.getByText('Installing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockInstall).toHaveBeenCalled();
    });
  });

  it('should clean up event listeners on unmount', () => {
    const unsubscribe = vi.fn();
    mockOnInstallAvailable.mockReturnValue(unsubscribe);

    const { unmount } = render(<PWAInstallPrompt />);

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});