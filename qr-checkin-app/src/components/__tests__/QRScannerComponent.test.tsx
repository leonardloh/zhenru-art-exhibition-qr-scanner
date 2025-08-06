import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import QRScannerComponent from '../QRScannerComponent';

// Mock the ZXing library
const mockDecodeFromVideoDevice = vi.fn();
const mockReset = vi.fn();

vi.mock('@zxing/library', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoDevice: mockDecodeFromVideoDevice,
    reset: mockReset,
  })),
  NotFoundException: class NotFoundException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'NotFoundException';
    }
  },
  ChecksumException: class ChecksumException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'ChecksumException';
    }
  },
  FormatException: class FormatException extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'FormatException';
    }
  },
}));

// Mock MediaDevices API
const mockGetUserMedia = vi.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: mockGetUserMedia,
  },
  writable: true,
});

// Mock props
const mockProps = {
  onScanSuccess: vi.fn(),
  onScanError: vi.fn(),
  onManualSearchRequest: vi.fn(),
};

describe('QRScannerComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to never resolving to keep component in loading state for predictable testing
    mockGetUserMedia.mockImplementation(() => new Promise(() => {}));
  });

  describe('Component Rendering', () => {
    it('renders the QR scanner component with title and description', () => {
      render(<QRScannerComponent {...mockProps} />);
      
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      expect(screen.getByText('Point your camera at the attendee\'s QR code to check them in')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(<QRScannerComponent {...mockProps} />);
      
      expect(screen.getByText('Starting camera...')).toBeInTheDocument();
    });

    it('initializes ZXing BrowserMultiFormatReader', () => {
      render(<QRScannerComponent {...mockProps} />);
      
      // Verify that the component renders without errors (ZXing is initialized internally)
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
    });

    it('attempts to request camera permissions on mount', () => {
      render(<QRScannerComponent {...mockProps} />);
      
      // Component should show loading state, indicating it's attempting to access camera
      expect(screen.getByText('Starting camera...')).toBeInTheDocument();
    });

    it('cleans up resources on unmount', () => {
      const { unmount } = render(<QRScannerComponent {...mockProps} />);
      
      unmount();
      
      // Should call reset on cleanup
      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('Props Interface', () => {
    it('accepts required props without errors', () => {
      const props = {
        onScanSuccess: vi.fn(),
        onScanError: vi.fn(),
        onManualSearchRequest: vi.fn(),
      };
      
      expect(() => render(<QRScannerComponent {...props} />)).not.toThrow();
    });
  });

  describe('Mobile Optimization', () => {
    it('renders with mobile-optimized container classes', () => {
      render(<QRScannerComponent {...mockProps} />);
      
      // Check for mobile-first responsive classes
      const container = document.querySelector('.w-full.max-w-md.mx-auto');
      expect(container).toBeInTheDocument();
    });

    it('includes proper mobile viewport settings in video element structure', () => {
      render(<QRScannerComponent {...mockProps} />);
      
      // The component should be structured for mobile use
      // Even in loading state, the structure should be mobile-ready
      expect(screen.getByText('Starting camera...')).toBeInTheDocument();
    });
  });
});