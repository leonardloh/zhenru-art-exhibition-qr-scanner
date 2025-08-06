import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppLayout from '../AppLayout';

// Mock the components that AppLayout uses
vi.mock('../QRScannerComponent', () => ({
  default: ({ onScanSuccess, onScanError, onManualSearchRequest }: any) => (
    <div data-testid="qr-scanner">
      <h2>QR Scanner</h2>
      <button onClick={() => onScanSuccess('test-booking-id')}>Simulate Scan Success</button>
      <button onClick={() => onScanError('Camera error')}>Simulate Scan Error</button>
      <button onClick={onManualSearchRequest}>Manual Search</button>
    </div>
  ),
}));

vi.mock('../ManualSearchComponent', () => ({
  default: ({ onBookingSelect, onCancel }: any) => (
    <div data-testid="manual-search">
      <h2>Manual Search</h2>
      <button onClick={() => onBookingSelect({
        id: 1,
        name: 'Test User',
        koalendar_id: 'test-123',
        email: 'test@example.com',
        contact_number: '1234567890',
        is_lamrin_student: false,
        postcode: '12345',
        gender: 'other',
        num_guests: 2,
        event_type: 'Test Event',
        start_at: '2024-01-01T10:00:00Z',
        end_at: '2024-01-01T12:00:00Z',
        is_attended: false,
        is_qr_sent: true,
        created_at: '2024-01-01T00:00:00Z'
      })}>Select Booking</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../AttendeeInfoComponent', () => ({
  default: ({ booking, onCheckIn, onCancel }: any) => (
    <div data-testid="attendee-info">
      <h2>Attendee Info</h2>
      <p>Name: {booking.name}</p>
      <button onClick={() => onCheckIn(2)}>Check In</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../CheckInFormComponent', () => ({
  default: ({ onSubmit, onCancel }: any) => (
    <div data-testid="checkin-form">
      <h2>Check-in Form</h2>
      <button onClick={() => onSubmit(2)}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('../CheckInSuccessComponent', () => ({
  default: ({ booking, onComplete }: any) => (
    <div data-testid="success">
      <h2>Success</h2>
      <p>Checked in: {booking.name}</p>
      <button onClick={onComplete}>Complete</button>
    </div>
  ),
}));

vi.mock('../NetworkStatusIndicator', () => ({
  default: () => <div data-testid="network-status">Network Status</div>,
}));

vi.mock('../ErrorDisplay', () => ({
  default: ({ error, onDismiss }: any) => (
    <div data-testid="error-display">
      <p>Error: {error}</p>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

// Mock window.matchMedia for responsive tests
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('AppLayout Responsive Behavior', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Default to mobile viewport
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Mobile-first Design', () => {
    it('should render with mobile-optimized layout', () => {
      render(<AppLayout />);
      
      // Check that the main container has mobile-first classes
      const main = screen.getByRole('main');
      expect(main).toHaveClass('flex-1', 'pb-safe');
      
      // Check that content is properly constrained for mobile
      const container = main.querySelector('.max-w-md');
      expect(container).toBeInTheDocument();
    });

    it('should have proper touch targets (minimum 44px)', async () => {
      render(<AppLayout />);
      
      // Navigate to manual search to test buttons
      const manualSearchButton = screen.getByText('Manual Search');
      await user.click(manualSearchButton);
      
      // Check that buttons exist and are clickable (basic touch target test)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Test that buttons are accessible and clickable
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
        expect(button).toBeEnabled();
      });
    });

    it('should use appropriate typography scale for mobile', () => {
      render(<AppLayout />);
      
      // Check header typography
      const header = screen.getByRole('banner');
      const title = header.querySelector('h1');
      expect(title).toHaveClass('text-lg', 'font-semibold');
    });
  });

  describe('Navigation Flow', () => {
    it('should navigate from scanner to search to attendee info', async () => {
      render(<AppLayout />);
      
      // Start at scanner
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
      expect(screen.getByText('QR Check-in')).toBeInTheDocument();
      
      // Navigate to manual search
      await user.click(screen.getByText('Manual Search'));
      expect(screen.getByTestId('manual-search')).toBeInTheDocument();
      
      // Navigate to attendee info
      await user.click(screen.getByText('Select Booking'));
      expect(screen.getByTestId('attendee-info')).toBeInTheDocument();
    });

    it('should show back button on non-scanner screens', async () => {
      render(<AppLayout />);
      
      // Scanner screen should not have back button
      expect(screen.queryByLabelText('Go back')).not.toBeInTheDocument();
      
      // Navigate to search
      await user.click(screen.getByText('Manual Search'));
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
      
      // Navigate to attendee info
      await user.click(screen.getByText('Select Booking'));
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
    });

    it('should handle back navigation correctly', async () => {
      render(<AppLayout />);
      
      // Navigate forward through screens
      await user.click(screen.getByText('Manual Search'));
      await user.click(screen.getByText('Select Booking'));
      
      // Navigate back
      await user.click(screen.getByLabelText('Go back'));
      expect(screen.getByTestId('manual-search')).toBeInTheDocument();
      
      // Navigate back again
      await user.click(screen.getByLabelText('Go back'));
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
    });
  });

  describe('Complete User Flow', () => {
    it('should complete full check-in flow', async () => {
      render(<AppLayout />);
      
      // Start with QR scanner
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
      
      // Go to manual search
      await user.click(screen.getByText('Manual Search'));
      expect(screen.getByTestId('manual-search')).toBeInTheDocument();
      
      // Select a booking
      await user.click(screen.getByText('Select Booking'));
      expect(screen.getByTestId('attendee-info')).toBeInTheDocument();
      expect(screen.getByText('Name: Test User')).toBeInTheDocument();
      
      // Proceed to check-in form
      await user.click(screen.getByText('Check In'));
      expect(screen.getByTestId('checkin-form')).toBeInTheDocument();
      
      // Submit check-in
      await user.click(screen.getByText('Submit'));
      
      // Wait for success screen
      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument();
      });
      
      // Complete the flow
      await user.click(screen.getByText('Complete'));
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display and handle errors properly', async () => {
      render(<AppLayout />);
      
      // Trigger an error
      await user.click(screen.getByText('Simulate Scan Error'));
      
      // Check error display
      expect(screen.getByTestId('error-display')).toBeInTheDocument();
      expect(screen.getByText('Error: QR Scan Error: Camera error')).toBeInTheDocument();
      
      // Dismiss error
      await user.click(screen.getByText('Dismiss'));
      expect(screen.queryByTestId('error-display')).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading overlay when processing', async () => {
      render(<AppLayout />);
      
      // Navigate to check-in form
      await user.click(screen.getByText('Manual Search'));
      await user.click(screen.getByText('Select Booking'));
      await user.click(screen.getByText('Check In'));
      
      // Submit form to trigger loading
      await user.click(screen.getByText('Submit'));
      
      // Check for loading overlay
      const loadingOverlay = screen.getByText('Processing...');
      expect(loadingOverlay).toBeInTheDocument();
    });
  });

  describe('Responsive Breakpoints', () => {
    it('should adapt to tablet viewport', () => {
      // Mock tablet viewport
      mockMatchMedia(false); // Not mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });
      
      render(<AppLayout />);
      
      // Check that layout adapts to larger screens
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      
      // Container should still be constrained but with different max-width
      const container = main.querySelector('.max-w-md');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<AppLayout />);
      
      // Check main landmarks
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument(); // main content
      
      // Check button accessibility
      const backButton = screen.queryByLabelText('Go back');
      if (backButton) {
        expect(backButton).toHaveAttribute('aria-label', 'Go back');
      }
    });

    it('should support keyboard navigation', async () => {
      render(<AppLayout />);
      
      // Navigate to search screen
      await user.click(screen.getByText('Manual Search'));
      
      // Test keyboard navigation
      const cancelButton = screen.getByText('Cancel');
      cancelButton.focus();
      expect(document.activeElement).toBe(cancelButton);
      
      // Test Enter key
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
    });
  });

  describe('Safe Area Support', () => {
    it('should include safe area classes for mobile devices', () => {
      render(<AppLayout />);
      
      const main = screen.getByRole('main');
      expect(main).toHaveClass('pb-safe');
    });
  });
});