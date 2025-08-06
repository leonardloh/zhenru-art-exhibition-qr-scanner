import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckInFormComponent from '../CheckInFormComponent';

describe('CheckInFormComponent - Core Functionality', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render form with expected guests information', () => {
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Check-in Form')).toBeInTheDocument();
      expect(screen.getByText('Expected guests:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    });

    it('should show update mode when currentActualGuests is provided', () => {
      render(
        <CheckInFormComponent
          expectedGuests={3}
          currentActualGuests={2}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Update Check-in' })).toBeInTheDocument();
      expect(screen.getByText('Current actual:')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty input', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      await user.clear(input);
      
      const submitButton = screen.getByRole('button', { name: /check in/i });
      await user.click(submitButton);

      expect(screen.getByText('Guest count is required')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should accept valid positive integers', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      await user.clear(input);
      await user.type(input, '5');
      
      const submitButton = screen.getByRole('button', { name: /check in/i });
      await user.click(submitButton);

      // Should show confirmation dialog, not validation error
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Confirm Check-in' })).toBeInTheDocument();
    });
  });

  describe('Quick Selection Buttons', () => {
    it('should render quick selection buttons based on expected guests', () => {
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    });

    it('should update input value when quick selection button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      const quickButton = screen.getByRole('button', { name: '2' });
      
      await user.click(quickButton);
      
      expect(input).toHaveValue(2);
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog when form is submitted with valid data', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      await user.clear(input);
      await user.type(input, '5');
      
      const submitButton = screen.getByRole('button', { name: /check in/i });
      await user.click(submitButton);

      expect(screen.getByRole('heading', { name: 'Confirm Check-in' })).toBeInTheDocument();
    });

    it('should call onSubmit when confirmation is confirmed', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      await user.clear(input);
      await user.type(input, '7');
      
      const submitButton = screen.getByRole('button', { name: /check in/i });
      await user.click(submitButton);

      const confirmButton = screen.getByRole('button', { name: /confirm check-in/i });
      await user.click(confirmButton);

      expect(mockOnSubmit).toHaveBeenCalledWith(7);
    });

    it('should close confirmation dialog when cancelled', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      await user.clear(input);
      await user.type(input, '5');
      
      const submitButton = screen.getByRole('button', { name: /check in/i });
      await user.click(submitButton);

      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
      const dialogCancelButton = cancelButtons.find(btn => 
        btn.closest('[role="dialog"]') || btn.closest('.fixed')
      );
      
      if (dialogCancelButton) {
        await user.click(dialogCancelButton);
      }

      expect(screen.queryByRole('heading', { name: 'Confirm Check-in' })).not.toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
      const formCancelButton = cancelButtons.find(btn => 
        !btn.closest('[role="dialog"]') && !btn.closest('.fixed')
      );
      
      if (formCancelButton) {
        await user.click(formCancelButton);
      }

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      expect(input).toHaveAttribute('id', 'actualGuests');
    });

    it('should have minimum touch target sizes', () => {
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      const submitButton = screen.getByRole('button', { name: /check in/i });
      const quickButtons = screen.getAllByRole('button').filter(btn => 
        ['2', '3', '4'].includes(btn.textContent || '')
      );

      expect(input).toHaveClass('min-h-[44px]');
      expect(submitButton).toHaveClass('min-h-[44px]');
      quickButtons.forEach(btn => expect(btn).toHaveClass('min-h-[44px]'));
    });
  });

  describe('Mobile-Friendly Features', () => {
    it('should have mobile-optimized input styling', () => {
      render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const input = screen.getByLabelText(/actual number of guests/i);
      expect(input).toHaveClass('text-lg', 'min-h-[44px]');
    });

    it('should have responsive layout classes', () => {
      const { container } = render(
        <CheckInFormComponent
          expectedGuests={3}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const mainContainer = container.querySelector('.max-w-md');
      expect(mainContainer).toHaveClass('mx-auto');
    });
  });
});