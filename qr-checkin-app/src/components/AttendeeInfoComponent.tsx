'use client';

import React from 'react';
import { BookingRecord } from '@/types/database';

interface AttendeeInfoProps {
  booking: BookingRecord;
  onCheckIn: (actualGuests: number, arrivalTime?: string) => void;
  onCancel: () => void;
}

/**
 * AttendeeInfoComponent displays comprehensive booking details
 * and provides check-in functionality for front desk administrators
 */
export default function AttendeeInfoComponent({ 
  booking, 
  onCheckIn, 
  onCancel 
}: AttendeeInfoProps) {
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

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid time';
    }
  };

  const getCheckInStatusDisplay = () => {
    if (booking.is_attended && booking.attended_at) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center mb-3">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
            <span className="text-green-800 font-semibold text-lg">Already Checked In</span>
          </div>
          <div className="text-sm text-green-700 space-y-1 leading-relaxed">
            <p><span className="font-medium">Check-in time:</span> {formatDateTime(booking.attended_at)}</p>
            {booking.actual_num_guests !== null && (
              <p><span className="font-medium">Actual guests:</span> {booking.actual_num_guests}</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-orange-500 rounded-full mr-3"></div>
          <span className="text-orange-800 font-semibold text-lg">Not Checked In</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center border-b border-gray-200 pb-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Attendee Information</h2>
        <p className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-1 rounded-lg inline-block">
          ID: {booking.koalender_id}
        </p>
      </div>

      {/* Check-in Status */}
      <div className="mb-6">
        {getCheckInStatusDisplay()}
      </div>

      {/* Actual Check-in Details (if already checked in) */}
      {booking.is_attended && booking.attended_at && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Actual Check-in Details
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-start py-2 border-b border-blue-100 last:border-b-0">
              <span className="text-sm font-medium text-blue-700 min-w-0 flex-shrink-0">Actual Arrival Time:</span>
              <span className="text-sm text-blue-900 text-right ml-4 font-mono min-w-0 flex-1">
                {formatDateTime(booking.attended_at)}
              </span>
            </div>
            
            <div className="flex justify-between items-start py-2">
              <span className="text-sm font-medium text-blue-700 min-w-0 flex-shrink-0">Actual Number of Guests:</span>
              <span className="text-lg text-blue-900 text-right font-bold ml-4">
                {booking.actual_num_guests !== null ? booking.actual_num_guests : 'Not recorded'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Personal Details
        </h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Name:</span>
            <span className="text-sm text-gray-900 text-right font-semibold ml-4 min-w-0 flex-1">
              {booking.name}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Email:</span>
            <span className="text-sm text-gray-900 text-right ml-4 min-w-0 flex-1 break-all">
              {booking.email}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Contact:</span>
            <span className="text-sm text-gray-900 text-right ml-4 font-mono">
              {booking.contact_number}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Student:</span>
            <span className={`text-sm font-semibold ml-4 ${
              booking.is_lamrin_student ? 'text-blue-600' : 'text-gray-900'
            }`}>
              {booking.is_lamrin_student ? 'Yes' : 'No'}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Postcode:</span>
            <span className="text-sm text-gray-900 text-right ml-4 font-mono">
              {booking.postcode}
            </span>
          </div>
        </div>
      </div>

      {/* Event Information */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Event Details
        </h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Event Type:</span>
            <span className="text-sm text-gray-900 text-right ml-4 font-semibold min-w-0 flex-1">
              {booking.event_type}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Start Time:</span>
            <span className="text-sm text-gray-900 text-right ml-4 font-mono min-w-0 flex-1">
              {formatDateTime(booking.start_at)}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">End Time:</span>
            <span className="text-sm text-gray-900 text-right ml-4 font-mono min-w-0 flex-1">
              {formatTime(booking.end_at)}
            </span>
          </div>
          
          <div className="flex justify-between items-start py-2">
            <span className="text-sm font-medium text-gray-600 min-w-0 flex-shrink-0">Expected Guests:</span>
            <span className="text-lg text-gray-900 text-right font-bold ml-4">
              {booking.num_guests}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col space-y-4">
        <button
          onClick={() => onCheckIn(booking.num_guests)}
          className="w-full btn-primary font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
          type="button"
        >
          {booking.is_attended ? 'Update Check-in' : 'Check In'}
        </button>
        
        <button
          onClick={onCancel}
          className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}