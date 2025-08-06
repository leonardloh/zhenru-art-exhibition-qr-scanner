'use client';

import React, { useState } from 'react';
import ManualSearchComponent from '@/components/ManualSearchComponent';
import type { BookingRecord } from '@/types/database';

export default function ManualSearchDemo() {
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [showSearch, setShowSearch] = useState(true);
  const handleSearchResult = (bookings: BookingRecord[]) => {
    console.log('Search results:', bookings);
  };

  const handleSearchError = (error: string) => {
    console.error('Search error:', error);
  };

  const handleBookingSelect = (booking: BookingRecord) => {
    setSelectedBooking(booking);
    setShowSearch(false);
    console.log('Selected booking:', booking);
  };

  const handleCancel = () => {
    setShowSearch(false);
    setSelectedBooking(null);
  };

  const handleBackToSearch = () => {
    setShowSearch(true);
    setSelectedBooking(null);
  };

  if (showSearch) {
    return (
      <ManualSearchComponent
        onSearchResult={handleSearchResult}
        onSearchError={handleSearchError}
        onBookingSelect={handleBookingSelect}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <button
            onClick={handleBackToSearch}
            className="flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Search
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Demo Results</h1>
        </div>

        {selectedBooking && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Selected Booking</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {selectedBooking.name}</p>
              <p><span className="font-medium">Email:</span> {selectedBooking.email}</p>
              <p><span className="font-medium">ID:</span> {selectedBooking.koalender_id}</p>
              <p><span className="font-medium">Event:</span> {selectedBooking.event_type}</p>
              <p><span className="font-medium">Expected Guests:</span> {selectedBooking.num_guests}</p>
              <p><span className="font-medium">Status:</span> 
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                  selectedBooking.is_attended 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedBooking.is_attended ? 'Checked In' : 'Not Checked In'}
                </span>
              </p>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Demo Information</h3>
          <p className="text-sm text-blue-800">
            This is a demo of the ManualSearchComponent. In the real application, 
            selecting a booking would navigate to the attendee information screen 
            where you can complete the check-in process.
          </p>
        </div>
      </div>
    </div>
  );
}