import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import ManualSearchComponent from '../ManualSearchComponent';
import * as database from '@/lib/database';
import type { BookingRecord } from '@/types/database';

// Mock the database module
vi.mock('@/lib/database', () => ({
  searchBookingsByPartialId: vi.fn(),
}));

const mockSearchBookingsByPartialId = vi.mocked(database.searchBookingsByPartialId);

// Mock booking data
const mockBooking1: BookingRecord = {
  id: 1,
  created_at: '2024-01-01T10:00:00Z',
  koalendar_id: 'TEST12345',
  event_type: 'Workshop',
  name: 'John Doe',
  email: 'john@example.com',
  contact_number: '+61400000000',
  is_lamrin_student: true,
  postcode: '2000',
  gender: 'male',
  num_guests: 2,
  start_at: '2024-01-15T14:00:00Z',
  end_at: '2024-01-15T16:00:00Z',
  is_qr_sent: true,
  qr_sent_at: '2024-01-10T09:00:00Z',
  qr_batch_id: 'batch123',
  is_attended: false,
  attended_at: null,
  actual_num_guests: null,
};

const mockBooking2: BookingRecord = {
  id: 2,
  created_at: '2024-01-02T11:00:00Z',
  koalendar_id: 'TEST67890',
  event_type: 'Seminar',
  name: 'Jane Smith',
  email: 'jane@example.com',
  contact_number: '+61400000001',
  is_lamrin_student: false,
  postcode: '3000',
  gender: 'female',
  num_guests: 1,
  start_at: '2024-01-16T10:00:00Z',
  end_at: '2024-01-16T12:00:00Z',
  is_qr_sent: true,
  qr_sent_at: '2024-01-11T09:00:00Z',
  qr_batch_id: 'batch124',
  is_attended: true,
  attended_at: '2024-01-16T09:45:00Z',
  actual_num_guests: 1,
};

const mockBookingCheckedIn: BookingRecord = {
  ...mockBooking1,
  id: 3,
  koalendar_id: 'TEST11111',
  is_attended: true,
  attended_at: '2024-01-15T13:45:00Z',
  actual_num_guests: 3,
};

describe('ManualSearchComponent', () => {
  const mockProps = {
    onSearchResult: vi.fn(),
    onSearchError: vi.fn(),
    onBookingSelect: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders the search interface correctly', () => {
      render(<ManualSearchComponent {...mockProps} />);
      
      expect(screen.getByText('Manual Search')).toBeInTheDocument();
      expect(screen.getByText('Enter the first 5+ characters of the booking ID to search')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter booking ID (min 5 chars)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('focuses the input field on mount', () => {
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      expect(input).toHaveFocus();
    });

    it('shows character counter when input is less than 5 characters', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      await user.type(input, 'TES');
      
      expect(screen.getByText('2 more')).toBeInTheDocument();
    });

    it('hides character counter when input is 5 or more characters', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      await user.type(input, 'TEST1');
      
      expect(screen.queryByText('1 more')).not.toBeInTheDocument();
    });
  });

  describe('Input Validation', () => {
    it('disables search button when input is less than 5 characters', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST');
      expect(searchButton).toBeDisabled();
    });

    it('enables search button when input is 5 or more characters', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      expect(searchButton).not.toBeDisabled();
    });

    it('shows validation error for invalid characters', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST@');
      await user.click(searchButton);
      
      expect(screen.getByText('Search term can only contain letters, numbers, hyphens, and underscores')).toBeInTheDocument();
      expect(mockProps.onSearchError).not.toHaveBeenCalled();
    });

    it('shows validation error for short search term', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      
      // Type 5 characters first to enable the button
      await user.type(input, 'TEST1');
      // Then clear and type less than 5 characters
      await user.clear(input);
      await user.type(input, 'TEST');
      
      // Now manually trigger the search function by pressing Enter
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('Search term must be at least 5 characters long')).toBeInTheDocument();
    });

    it('clears error when user starts typing', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      // Create an error first
      await user.type(input, 'TEST@');
      await user.click(searchButton);
      expect(screen.getByText('Search term can only contain letters, numbers, hyphens, and underscores')).toBeInTheDocument();
      
      // Clear and type new input
      await user.clear(input);
      await user.type(input, 'T');
      
      expect(screen.queryByText('Search term can only contain letters, numbers, hyphens, and underscores')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('performs search when search button is clicked', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1, mockBooking2],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      expect(mockSearchBookingsByPartialId).toHaveBeenCalledWith('TEST1');
      await waitFor(() => {
        expect(mockProps.onSearchResult).toHaveBeenCalledWith([mockBooking1, mockBooking2]);
      });
    });

    it('performs search when Enter key is pressed', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      
      await user.type(input, 'TEST1');
      await user.keyboard('{Enter}');
      
      expect(mockSearchBookingsByPartialId).toHaveBeenCalledWith('TEST1');
      await waitFor(() => {
        expect(mockProps.onSearchResult).toHaveBeenCalledWith([mockBooking1]);
      });
    });

    it('shows loading state during search', async () => {
      const user = userEvent.setup();
      let resolveSearch: (value: { bookings: BookingRecord[] }) => void;
      const searchPromise = new Promise((resolve) => {
        resolveSearch = resolve;
      });
      mockSearchBookingsByPartialId.mockReturnValue(searchPromise);
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      expect(screen.getByText('Searching...')).toBeInTheDocument();
      expect(searchButton).toBeDisabled();
      expect(input).toBeDisabled();
      
      // Resolve the search
      resolveSearch!({ bookings: [] });
      
      await waitFor(() => {
        expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
      });
    });

    it('trims whitespace from search term', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, '  TEST1  ');
      await user.click(searchButton);
      
      expect(mockSearchBookingsByPartialId).toHaveBeenCalledWith('TEST1');
    });
  });

  describe('Search Results Display', () => {
    it('displays search results correctly', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1, mockBooking2],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('Found 2 bookings')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('ID: TEST12345')).toBeInTheDocument();
        expect(screen.getByText('ID: TEST67890')).toBeInTheDocument();
      });
    });

    it('displays no results message when no bookings found', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'NOTFOUND');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('No bookings found')).toBeInTheDocument();
        expect(screen.getByText('No bookings match "NOTFOUND". Try a different search term.')).toBeInTheDocument();
      });
    });

    it('displays check-in status correctly', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1, mockBookingCheckedIn],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('Not Checked In')).toBeInTheDocument();
        expect(screen.getByText('Checked In')).toBeInTheDocument();
      });
    });

    it('displays checked-in details for attended bookings', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBookingCheckedIn],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Checked in:/)).toBeInTheDocument();
        expect(screen.getByText(/\(3 guests\)/)).toBeInTheDocument();
      });
    });

    it('calls onBookingSelect when a booking is clicked', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      const bookingCard = screen.getByText('John Doe').closest('[role="button"]');
      await user.click(bookingCard!);
      
      expect(mockProps.onBookingSelect).toHaveBeenCalledWith(mockBooking1);
    });

    it('calls onBookingSelect when Enter key is pressed on a booking', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      const bookingCard = screen.getByText('John Doe').closest('[role="button"]');
      bookingCard!.focus();
      await user.keyboard('{Enter}');
      
      expect(mockProps.onBookingSelect).toHaveBeenCalledWith(mockBooking1);
    });

    it('clears results when search term changes', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      // Perform initial search
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      
      // Change search term
      await user.clear(input);
      await user.type(input, 'OTHER');
      
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles database errors correctly', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Database connection failed';
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [],
        error: {
          message: errorMessage,
          code: 'DATABASE_ERROR',
        },
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(mockProps.onSearchError).toHaveBeenCalledWith(errorMessage);
      });
    });

    it('handles unexpected errors correctly', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockRejectedValue(new Error('Network error'));
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred while searching')).toBeInTheDocument();
        expect(mockProps.onSearchError).toHaveBeenCalledWith('An unexpected error occurred while searching');
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      expect(input).toBeInTheDocument();
      
      const searchButton = screen.getByRole('button', { name: 'Search' });
      expect(searchButton).toBeInTheDocument();
      
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeInTheDocument();
    });

    it('shows error messages with proper role', async () => {
      const user = userEvent.setup();
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST@');
      await user.click(searchButton);
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Search term can only contain letters, numbers, hyphens, and underscores');
    });

    it('makes booking cards keyboard accessible', async () => {
      const user = userEvent.setup();
      mockSearchBookingsByPartialId.mockResolvedValue({
        bookings: [mockBooking1],
      });
      
      render(<ManualSearchComponent {...mockProps} />);
      
      const input = screen.getByPlaceholderText('Enter booking ID (min 5 chars)');
      const searchButton = screen.getByRole('button', { name: 'Search' });
      
      await user.type(input, 'TEST1');
      await user.click(searchButton);
      
      await waitFor(() => {
        const bookingCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(bookingCard).toHaveAttribute('tabIndex', '0');
      });
    });
  });
});