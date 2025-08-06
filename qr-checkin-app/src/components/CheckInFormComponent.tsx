'use client';

import React, { useState, useCallback } from 'react';

interface CheckInFormProps {
  expectedGuests: number;
  currentActualGuests?: number;
  onSubmit: (actualGuests: number, arrivalTime: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * CheckInFormComponent provides a form for entering actual guest count
 * with validation and confirmation dialog for the check-in process
 */
export default function CheckInFormComponent({
  expectedGuests,
  currentActualGuests,
  onSubmit,
  onCancel,
  isSubmitting = false
}: CheckInFormProps) {
  const [actualGuests, setActualGuests] = useState<string>(
    currentActualGuests?.toString() || expectedGuests.toString()
  );
  const [arrivalTime, setArrivalTime] = useState<string>(() => {
    // Default to current date and time in local timezone
    const now = new Date();
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Validate guest count input
  const validateGuestCount = useCallback((value: string): string | null => {
    if (!value.trim()) {
      return 'Guest count is required';
    }

    const numValue = parseInt(value, 10);
    
    if (isNaN(numValue)) {
      return 'Please enter a valid number';
    }

    if (numValue < 0) {
      return 'Guest count cannot be negative';
    }

    if (numValue > 999) {
      return 'Guest count seems too high (max 999)';
    }

    if (!Number.isInteger(numValue)) {
      return 'Guest count must be a whole number';
    }

    return null;
  }, []);

  // Handle input change with validation
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setActualGuests(value);
    
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateGuestCount(actualGuests);
    if (error) {
      setValidationError(error);
      return;
    }

    setShowConfirmation(true);
  };

  // Handle confirmation
  const handleConfirm = () => {
    const numGuests = parseInt(actualGuests, 10);
    onSubmit(numGuests, arrivalTime);
    setShowConfirmation(false);
  };

  // Handle cancel confirmation
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  // Render confirmation dialog
  const renderConfirmationDialog = () => {
    if (!showConfirmation) return null;

    const numGuests = parseInt(actualGuests, 10);
    const isUpdate = currentActualGuests !== undefined;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
            {isUpdate ? 'Update Check-in' : 'Confirm Check-in'}
          </h3>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Expected guests:</span>
              <span className="font-bold text-lg">{expectedGuests}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Actual guests:</span>
              <span className="font-bold text-lg text-blue-600">{numGuests}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600 font-medium">Arrival time:</span>
              <span className="font-bold text-sm text-blue-600">
                {new Date(arrivalTime).toLocaleString('en-AU', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                })}
              </span>
            </div>
            {isUpdate && currentActualGuests !== undefined && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500 text-sm">Previous count:</span>
                <span className="text-gray-500 text-sm">{currentActualGuests}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-4">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full btn-primary font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
              type="button"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <div className="spinner h-5 w-5 mr-3"></div>
                  {isUpdate ? 'Updating...' : 'Checking In...'}
                </span>
              ) : (
                `${isUpdate ? 'Update' : 'Confirm'} Check-in`
              )}
            </button>
            
            <button
              onClick={handleCancelConfirmation}
              disabled={isSubmitting}
              className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentActualGuests !== undefined ? 'Update Check-in' : 'Check-in Form'}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Enter the actual number of guests attending
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" role="form">
          {/* Expected vs Actual Guests Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 mb-2">
              <span className="text-sm font-medium text-gray-600">Expected guests:</span>
              <span className="text-xl font-bold text-gray-900">{expectedGuests}</span>
            </div>
            {currentActualGuests !== undefined && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-600">Current actual:</span>
                <span className="text-xl font-bold text-blue-600">{currentActualGuests}</span>
              </div>
            )}
          </div>

          {/* Guest Count Input */}
          <div className="space-y-3">
            <label 
              htmlFor="actualGuests" 
              className="block text-base font-semibold text-gray-900"
            >
              Actual number of guests *
            </label>
            <input
              id="actualGuests"
              type="number"
              min="0"
              max="999"
              value={actualGuests}
              onChange={handleInputChange}
              className={`w-full px-4 py-4 text-xl border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 touch-target-comfortable text-center font-bold ${
                validationError 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-300 focus:border-blue-500'
              }`}
              placeholder="0"
              disabled={isSubmitting}
              autoFocus
            />
            {validationError && (
              <p className="text-sm text-red-600 leading-relaxed" role="alert" aria-live="polite">
                {validationError}
              </p>
            )}
          </div>

          {/* Arrival Time Input */}
          <div className="space-y-3">
            <label 
              htmlFor="arrivalTime" 
              className="block text-base font-semibold text-gray-900"
            >
              Arrival time *
            </label>
            <input
              id="arrivalTime"
              type="datetime-local"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-target-comfortable"
              disabled={isSubmitting}
            />
            <p className="text-sm text-gray-600">
              Defaults to current time. Adjust if needed.
            </p>
          </div>

          {/* Quick Selection Buttons */}
          <div className="space-y-4">
            <p className="text-base font-semibold text-gray-900">Quick select:</p>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setActualGuests(num.toString());
                    setValidationError('');
                  }}
                  disabled={isSubmitting}
                  className={`py-3 px-3 rounded-lg font-bold text-lg transition-colors duration-200 touch-target-comfortable ${
                    actualGuests === num.toString()
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  } disabled:opacity-50`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !!validationError}
              className="w-full btn-primary font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
            >
              {currentActualGuests !== undefined ? 'Review Update' : 'Review Check-in'}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-semibold py-4 px-6 rounded-xl transition-colors duration-200 touch-target-comfortable text-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {renderConfirmationDialog()}
    </>
  );
}