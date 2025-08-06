'use client';

import React from 'react';
import { BookingRecord } from '@/types/database';

interface CheckInSuccessProps {
  booking: BookingRecord;
  isDuplicateCheckIn?: boolean;
  previousCheckIn?: {
    attendedAt: string;
    actualGuests: number;
  };
  retryCount?: number;
  onComplete: () => void;
  onNewScan?: () => void;
}

/**
 * CheckInSuccessComponent displays confirmation of successful check-in
 * with comprehensive information and next action options
 */
export default function CheckInSuccessComponent({
  booking,
  isDuplicateCheckIn = false,
  previousCheckIn,
  retryCount = 0,
  onComplete,
  onNewScan
}: CheckInSuccessProps) {
  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-AU', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getSuccessIcon = () => {
    if (isDuplicateCheckIn) {
      return (
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
      );
    }

    return (
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  };

  const getStatusColor = () => {
    return isDuplicateCheckIn ? 'orange' : 'green';
  };

  const statusColor = getStatusColor();

  return (
    <div className="w-full">
      {/* Success Icon and Title */}
      <div className="text-center mb-8 landscape-compact">
        {getSuccessIcon()}
        
        <h2 className={`text-3xl font-bold mb-3 ${
          statusColor === 'green' ? 'text-green-800' : 'text-orange-800'
        }`}>
          {isDuplicateCheckIn ? 'Check-in Updated!' : 'Check-in Successful!'}
        </h2>
        
        <p className="text-gray-600 text-lg leading-relaxed">
          {isDuplicateCheckIn 
            ? 'Attendee information has been updated'
            : 'Attendee has been successfully checked in'
          }
        </p>
      </div>

      {/* Attendee Summary */}
      <div className={`${
        statusColor === 'green' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-orange-50 border-orange-200'
      } border rounded-xl p-6 mb-6`}>
        <div className="text-center">
          <h3 className={`text-xl font-bold mb-4 ${
            statusColor === 'green' ? 'text-green-800' : 'text-orange-800'
          }`}>
            {booking.name}
          </h3>
          <div className="space-y-3 text-base">
            <p className={`${
              statusColor === 'green' ? 'text-green-700' : 'text-orange-700'
            } leading-relaxed`}>
              <span className="font-semibold">Booking ID:</span> <span className="font-mono">{booking.koalender_id}</span>
            </p>
            <p className={`${
              statusColor === 'green' ? 'text-green-700' : 'text-orange-700'
            } leading-relaxed`}>
              <span className="font-semibold">Actual Guests:</span> <span className="text-xl font-bold">{booking.actual_num_guests}</span>
            </p>
            <p className={`${
              statusColor === 'green' ? 'text-green-700' : 'text-orange-700'
            } leading-relaxed`}>
              <span className="font-semibold">Check-in Time:</span> <span className="font-mono">{formatDateTime(booking.attended_at!)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Duplicate Check-in Warning */}
      {isDuplicateCheckIn && previousCheckIn && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="text-sm">
              <p className="font-medium text-yellow-800 mb-1">Previous Check-in Updated</p>
              <p className="text-yellow-700">
                Previous: {formatDateTime(previousCheckIn.attendedAt)} 
                ({previousCheckIn.actualGuests} guest{previousCheckIn.actualGuests !== 1 ? 's' : ''})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Retry Information */}
      {retryCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-700">
              Completed after {retryCount} retry{retryCount > 1 ? 'ies' : ''} due to network issues
            </p>
          </div>
        </div>
      )}

      {/* Event Details Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h4 className="font-semibold text-gray-900 mb-4 text-lg">Event Summary</h4>
        <div className="grid grid-cols-1 gap-4 text-base">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600 font-medium">Event:</span>
            <span className="font-semibold text-gray-900 text-right">{booking.event_type}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600 font-medium">Expected:</span>
            <span className="font-semibold text-gray-900">{booking.num_guests} guest{booking.num_guests !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-600 font-medium">Student:</span>
            <span className={`font-semibold ${booking.is_lamrin_student ? 'text-blue-600' : 'text-gray-900'}`}>
              {booking.is_lamrin_student ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 font-medium">Contact:</span>
            <span className="font-semibold text-gray-900 font-mono">{booking.contact_number}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col space-y-4">
        {onNewScan && (
          <button
            onClick={onNewScan}
            className={`w-full ${
              statusColor === 'green' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-orange-600 hover:bg-orange-700'
            } text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg`}
            type="button"
          >
            Scan Next QR Code
          </button>
        )}
        
        <button
          onClick={onComplete}
          className="w-full btn-primary font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
          type="button"
        >
          {onNewScan ? 'Back to Home' : 'Continue'}
        </button>
      </div>
    </div>
  );
}