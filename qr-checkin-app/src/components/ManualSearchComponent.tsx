'use client';

import React, { useState, useCallback } from 'react';
import { searchBookingsByPartialId } from '@/lib/database';
import type { BookingRecord } from '@/types/database';

interface ManualSearchProps {
  onSearchResult: (bookings: BookingRecord[]) => void;
  onSearchError: (error: string) => void;
  onBookingSelect: (booking: BookingRecord) => void;
  onCancel: () => void;
}

export default function ManualSearchComponent({
  onSearchResult,
  onSearchError,
  onBookingSelect,
  onCancel,
}: ManualSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BookingRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);

  const validateSearchTerm = (term: string): string | null => {
    if (term.length < 5) {
      return 'Search term must be at least 5 characters long';
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(term)) {
      return 'Search term can only contain letters, numbers, hyphens, and underscores';
    }
    return null;
  };

  const handleSearch = useCallback(async () => {
    const trimmedTerm = searchTerm.trim();
    const validationError = validateSearchTerm(trimmedTerm);

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSearching(true);
    setError('');
    setHasSearched(false);

    try {
      const result = await searchBookingsByPartialId(trimmedTerm);

      if (result.error) {
        setError(result.error.message);
        setSearchResults([]);
        onSearchError(result.error.message);
      } else {
        setSearchResults(result.bookings);
        setHasSearched(true);
        onSearchResult(result.bookings);
      }
    } catch {
      const errorMessage = 'An unexpected error occurred while searching';
      setError(errorMessage);
      setSearchResults([]);
      onSearchError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, onSearchResult, onSearchError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Clear error when user starts typing
    if (error) {
      setError('');
    }

    // Clear results when search term changes
    if (searchResults.length > 0) {
      setSearchResults([]);
      setHasSearched(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEventTime = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);

    return `${start.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    })} - ${end.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Manual Search</h2>
        <p className="text-gray-600 leading-relaxed">
          Enter the first 5+ characters of the booking ID to search
        </p>
      </div>

      {/* Search Input */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter booking ID (min 5 chars)"
            className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 touch-target-comfortable ${error
              ? 'border-red-300 focus:border-red-500'
              : 'border-gray-300 focus:border-blue-500'
              }`}
            disabled={isSearching}
            autoFocus
          />
          {searchTerm.length > 0 && searchTerm.length < 5 && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <span className="text-sm text-gray-500 font-medium">
                {5 - searchTerm.length} more
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 leading-relaxed" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleSearch}
          disabled={isSearching || searchTerm.trim().length < 5}
          className="flex-1 btn-primary py-4 px-6 rounded-xl font-medium text-lg disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors touch-target-comfortable"
        >
          {isSearching ? (
            <span className="flex items-center justify-center">
              <div className="spinner h-5 w-5 mr-3"></div>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </button>

        <button
          onClick={onCancel}
          className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors touch-target-comfortable"
        >
          Cancel
        </button>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="space-y-4">
          {searchResults.length === 0 ? (
            <div className="text-center py-12 landscape-compact">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0118 12a8 8 0 01-8 8 8 8 0 01-8-8 8 8 0 018-8c.075 0 .15.003.225.007" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-600 leading-relaxed max-w-sm mx-auto">
                No bookings match &quot;{searchTerm}&quot;. Try a different search term.
              </p>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-6 font-medium">
                Found {searchResults.length} booking{searchResults.length !== 1 ? 's' : ''}
              </div>

              {searchResults.map((booking) => (
                <div
                  key={booking.id}
                  onClick={() => onBookingSelect(booking)}
                  className="bg-white border-2 border-gray-200 rounded-xl p-5 cursor-pointer hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors touch-target-comfortable"
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onBookingSelect(booking);
                    }
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-gray-900 truncate">
                        {booking.name}
                      </h3>
                      <p className="text-sm text-gray-600 font-mono">
                        ID: {booking.koalender_id}
                      </p>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${booking.is_attended
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {booking.is_attended ? 'Checked In' : 'Not Checked In'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
                    <p>
                      <span className="font-medium text-gray-900">Event:</span> {booking.event_type}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Time:</span> {formatEventTime(booking.start_at, booking.end_at)}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Expected Guests:</span> {booking.num_guests}
                    </p>
                    {booking.is_attended && booking.attended_at && (
                      <p>
                        <span className="font-medium text-gray-900">Checked in:</span> {formatDateTime(booking.attended_at)}
                        {booking.actual_num_guests !== undefined && (
                          <span> ({booking.actual_num_guests} guests)</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <span className="text-blue-600 text-sm font-semibold flex items-center">
                      Tap to select
                      <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}