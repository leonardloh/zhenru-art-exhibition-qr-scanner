import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttendeeInfoComponent from '../AttendeeInfoComponent';
import { BookingRecord } from '@/types/database';

// Mock booking data for testing
const mockBookingNotCheckedIn: BookingRecord = {
  id: 1,
  created_at: '2024-01-15T10:00:00Z',
  koalendar_id: 'KOA123456',
  event_type: 'Workshop',
  name: 'John Doe',
  email: 'john.doe@example.com',
  contact_number: '+61412345678',
  is_lamrin_student: true,
  postcode: '2000',
  gender: 'Male',
  num_guests: 2,
  start_at: '2024-01-20T14:00:00Z',
  end_at: '2024-01-20T16:00:00Z',
  is_qr_sent: true,
  qr_sent_at: '2024-01-15T10:30:00Z',
  qr_batch_id: 'BATCH001',
  is_attended: false,
  attended_at: null,
  actual_num_guests: null
};

const mockBookingCheckedIn: BookingRecord = {
  ...mockBookingNotCheckedIn,
  is_attended: true,
  attended_at: '2024-01-20T13:45:00Z',
  actual_num_guests: 3
};

describe('AttendeeInfoComponent', () => {
  const mockOnCheckIn = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Personal Details Display', () => {
    it('should display attendee name correctly', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display attendee email correctly', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });

    it('should display contact number correctly', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('+61412345678')).toBeInTheDocument();
    });

    it('should display student status as "Yes" for Lamrin students', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Yes')).toBeInTheDocument();
    });

    it('should display student status as "No" for non-Lamrin students', () => {
      const nonStudentBooking = { ...mockBookingNotCheckedIn, is_lamrin_student: false };
      
      render(
        <AttendeeInfoComponent
          booking={nonStudentBooking}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('should display postcode correctly', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('2000')).toBeInTheDocument();
    });
  });

  describe('Event Details Display', () => {
    it('should display event type correctly', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Workshop')).toBeInTheDocument();
    });

    it('should display expected number of guests', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should display booking ID', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Booking ID: KOA123456')).toBeInTheDocument();
    });
  });

  describe('Date and Time Formatting', () => {
    it('should format start time correctly', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      // The exact format may vary based on locale, but should contain date and time elements
      const startTimeElement = screen.getByText(/Sat.*Jan.*2024.*10:00.*pm/i);
      expect(startTimeElement).toBeInTheDocument();
    });

    it('should handle invalid date strings gracefully', () => {
      const invalidDateBooking = {
        ...mockBookingNotCheckedIn,
        start_at: 'invalid-date',
        end_at: 'invalid-date'
      };

      render(
        <AttendeeInfoComponent
          booking={invalidDateBooking}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getAllByText('Invalid Date')).toHaveLength(2);
    });
  });

  describe('Check-in Status Display', () => {
    it('should show "Not Checked In" status for unattended bookings', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Not Checked In')).toBeInTheDocument();
    });

    it('should show "Already Checked In" status for attended bookings', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Already Checked In')).toBeInTheDocument();
    });

    it('should display previous check-in information for attended bookings', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Check-in time:/)).toBeInTheDocument();
      expect(screen.getByText('Actual guests: 3')).toBeInTheDocument();
    });

    it('should not display actual guests if not set', () => {
      const checkedInWithoutGuests = {
        ...mockBookingCheckedIn,
        actual_num_guests: null
      };

      render(
        <AttendeeInfoComponent
          booking={checkedInWithoutGuests}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText(/Actual guests:/)).not.toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('should call onCheckIn with expected guests when Check In button is clicked', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      const checkInButton = screen.getByText('Check In');
      fireEvent.click(checkInButton);

      expect(mockOnCheckIn).toHaveBeenCalledWith(2);
    });

    it('should show "Update Check-in" button text for already checked-in attendees', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Update Check-in')).toBeInTheDocument();
    });

    it('should call onCancel when Cancel button is clicked', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should have minimum touch target size for buttons', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      const checkInButton = screen.getByText('Check In');
      const cancelButton = screen.getByText('Cancel');

      // Check that buttons have the min-h-[44px] class for touch targets
      expect(checkInButton).toHaveClass('min-h-[44px]');
      expect(cancelButton).toHaveClass('min-h-[44px]');
    });
  });

  describe('Responsive Layout', () => {
    it('should apply mobile-first responsive classes', () => {
      const { container } = render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer).toHaveClass('max-w-md', 'mx-auto');
    });

    it('should use grid layout for information display', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      const gridElements = screen.getAllByText('Name:').map(el => el.parentElement);
      gridElements.forEach(element => {
        expect(element).toHaveClass('flex', 'justify-between');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('heading', { level: 2, name: 'Attendee Information' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Personal Details' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Event Details' })).toBeInTheDocument();
    });

    it('should have proper button types', () => {
      render(
        <AttendeeInfoComponent
          booking={mockBookingNotCheckedIn}
          onCheckIn={mockOnCheckIn}
          onCancel={mockOnCancel}
        />
      );

      const checkInButton = screen.getByText('Check In');
      const cancelButton = screen.getByText('Cancel');

      expect(checkInButton).toHaveAttribute('type', 'button');
      expect(cancelButton).toHaveAttribute('type', 'button');
    });
  });
});