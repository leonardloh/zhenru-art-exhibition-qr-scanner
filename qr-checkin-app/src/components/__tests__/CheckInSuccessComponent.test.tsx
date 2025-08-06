/**
 * Unit tests for CheckInSuccessComponent
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CheckInSuccessComponent from '../CheckInSuccessComponent';
import type { BookingRecord } from '@/types/database';

const mockBooking: BookingRecord = {
  id: 1,
  created_at: '2024-01-01T10:00:00Z',
  koalendar_id: 'TEST123456',
  event_type: 'Workshop',
  name: 'John Doe',
  email: 'john@example.com',
  contact_number: '+61400000000',
  is_lamrin_student: true,
  postcode: '2000',
  gender: 'Male',
  num_guests: 2,
  start_at: '2024-01-01T14:00:00Z',
  end_at: '2024-01-01T16:00:00Z',
  is_qr_sent: true,
  qr_sent_at: '2024-01-01T12:00:00Z',
  qr_batch_id: 'BATCH001',
  is_attended: true,
  attended_at: '2024-01-01T14:30:00Z',
  actual_num_guests: 3
};

describe('CheckInSuccessComponent', () => {
  const defaultProps = {
    booking: mockBooking,
    onContinue: vi.fn(),
    onNewScan: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successful first-time check-in', () => {
    render(<CheckInSuccessComponent {...defaultProps} />);

    expect(screen.getByText('Check-in Successful!')).toBeInTheDocument();
    expect(screen.getByText('Attendee has been successfully checked in')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Booking ID:')).toBeInTheDocument();
    expect(screen.getByText('TEST123456')).toBeInTheDocument();
    expect(screen.getByText('Actual Guests:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should render duplicate check-in with warning', () => {
    const previousCheckIn = {
      attendedAt: '2024-01-01T14:00:00Z',
      actualGuests: 2
    };

    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        isDuplicateCheckIn={true}
        previousCheckIn={previousCheckIn}
      />
    );

    expect(screen.getByText('Check-in Updated!')).toBeInTheDocument();
    expect(screen.getByText('Attendee information has been updated')).toBeInTheDocument();
    expect(screen.getByText('Previous Check-in Updated')).toBeInTheDocument();
    expect(screen.getByText(/Previous:.*2 guests/)).toBeInTheDocument();
  });

  it('should display retry information when retries occurred', () => {
    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        retryCount={2}
      />
    );

    // Check that the retry information section exists
    const retrySection = document.querySelector('.bg-blue-50');
    expect(retrySection).toBeInTheDocument();
  });

  it('should display retry information with singular form', () => {
    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        retryCount={1}
      />
    );

    expect(screen.getByText('Completed after 1 retry due to network issues')).toBeInTheDocument();
  });

  it('should display event summary information', () => {
    render(<CheckInSuccessComponent {...defaultProps} />);

    expect(screen.getByText('Event Summary')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
    expect(screen.getByText('2 guests')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument(); // Student status
    expect(screen.getByText('+61400000000')).toBeInTheDocument();
  });

  it('should handle singular guest count in event summary', () => {
    const singleGuestBooking = {
      ...mockBooking,
      num_guests: 1,
      actual_num_guests: 1
    };

    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        booking={singleGuestBooking}
      />
    );

    expect(screen.getByText('1 guest')).toBeInTheDocument();
    expect(screen.queryByText('1 guests')).not.toBeInTheDocument();
  });

  it('should call onNewScan when "Scan Next QR Code" button is clicked', () => {
    const onNewScan = vi.fn();
    render(<CheckInSuccessComponent {...defaultProps} onNewScan={onNewScan} />);

    const scanButton = screen.getByText('Scan Next QR Code');
    fireEvent.click(scanButton);

    expect(onNewScan).toHaveBeenCalledTimes(1);
  });

  it('should call onContinue when "Back to Home" button is clicked', () => {
    const onContinue = vi.fn();
    render(<CheckInSuccessComponent {...defaultProps} onContinue={onContinue} />);

    const continueButton = screen.getByText('Back to Home');
    fireEvent.click(continueButton);

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should format date and time correctly', () => {
    render(<CheckInSuccessComponent {...defaultProps} />);

    // The exact format depends on locale, but should contain date/time elements
    expect(screen.getByText('Check-in Time:')).toBeInTheDocument();
    
    // Should contain some recognizable date/time parts - look for the formatted date
    expect(screen.getByText(/Mon, 1 Jan 2024/)).toBeInTheDocument();
  });

  it('should handle invalid dates gracefully', () => {
    const invalidDateBooking = {
      ...mockBooking,
      attended_at: 'invalid-date'
    };

    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        booking={invalidDateBooking}
      />
    );

    expect(screen.getByText('Check-in Time:')).toBeInTheDocument();
    expect(screen.getByText('Invalid Date')).toBeInTheDocument();
  });

  it('should display non-student status correctly', () => {
    const nonStudentBooking = {
      ...mockBooking,
      is_lamrin_student: false
    };

    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        booking={nonStudentBooking}
      />
    );

    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should use appropriate colors for duplicate check-in', () => {
    const previousCheckIn = {
      attendedAt: '2024-01-01T14:00:00Z',
      actualGuests: 2
    };

    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        isDuplicateCheckIn={true}
        previousCheckIn={previousCheckIn}
      />
    );

    // Check for orange color classes (duplicate check-in uses orange theme)
    const title = screen.getByText('Check-in Updated!');
    expect(title).toHaveClass('text-orange-800');
  });

  it('should use appropriate colors for successful check-in', () => {
    render(<CheckInSuccessComponent {...defaultProps} />);

    // Check for green color classes (successful check-in uses green theme)
    const title = screen.getByText('Check-in Successful!');
    expect(title).toHaveClass('text-green-800');
  });

  it('should not display retry information when retryCount is 0', () => {
    render(
      <CheckInSuccessComponent 
        {...defaultProps} 
        retryCount={0}
      />
    );

    expect(screen.queryByText(/retry/i)).not.toBeInTheDocument();
  });

  it('should not display previous check-in warning for first-time check-ins', () => {
    render(<CheckInSuccessComponent {...defaultProps} />);

    expect(screen.queryByText('Previous Check-in Updated')).not.toBeInTheDocument();
  });
});