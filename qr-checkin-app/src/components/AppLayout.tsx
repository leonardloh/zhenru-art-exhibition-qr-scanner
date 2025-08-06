'use client';

import React, { useState } from 'react';
import QRScannerComponent from './QRScannerComponent';
import ManualSearchComponent from './ManualSearchComponent';
import AttendeeInfoComponent from './AttendeeInfoComponent';
import CheckInFormComponent from './CheckInFormComponent';
import CheckInSuccessComponent from './CheckInSuccessComponent';
import NetworkStatusIndicator from './NetworkStatusIndicator';
import ErrorDisplay from './ErrorDisplay';
import { findBookingByQRCode, checkInAttendee } from '@/lib/database';
import type { BookingRecord } from '@/types/database';

type AppScreen = 'scanner' | 'search' | 'attendee-info' | 'checkin-form' | 'success';

interface AppState {
  currentScreen: AppScreen;
  selectedBooking: BookingRecord | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Main application layout component that manages navigation flow
 * between different screens in the check-in process
 */
export default function AppLayout() {
  const [appState, setAppState] = useState<AppState>({
    currentScreen: 'scanner',
    selectedBooking: null,
    error: null,
    isLoading: false,
  });

  // Navigation handlers
  const navigateToScreen = (screen: AppScreen, booking?: BookingRecord) => {
    setAppState(prev => ({
      ...prev,
      currentScreen: screen,
      selectedBooking: booking || prev.selectedBooking,
      error: null,
    }));
  };

  const handleError = (error: string) => {
    setAppState(prev => ({
      ...prev,
      error,
      isLoading: false,
    }));
  };

  const clearError = () => {
    setAppState(prev => ({
      ...prev,
      error: null,
    }));
  };

  // QR Scanner handlers
  const handleQRScanSuccess = async (bookingId: string) => {
    setAppState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Add timeout to prevent getting stuck in loading state
    const timeoutId = setTimeout(() => {
      setAppState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: 'Request timed out. Please try again or use manual search.'
      }));
    }, 10000); // 10 second timeout
    
    try {
      console.log('QR scan successful, looking up booking:', bookingId);
      
      // Validate QR code format (basic check)
      if (!bookingId || bookingId.trim().length === 0) {
        throw new Error('QR code is empty or invalid');
      }
      
      // Look up the booking in the database
      const result = await findBookingByQRCode(bookingId.trim());
      
      // Clear timeout since we got a response
      clearTimeout(timeoutId);
      
      if (result.error) {
        // Database error occurred
        throw new Error(result.error.message);
      }
      
      if (!result.bookings || result.bookings.length === 0) {
        // No booking found - this is the key fix
        throw new Error('No booking found with this QR code. Please check the QR code or use manual search.');
      }
      
      // Booking found successfully
      const booking = result.bookings[0];
      console.log('Booking found:', booking);
      
      setAppState(prev => ({ ...prev, isLoading: false }));
      navigateToScreen('attendee-info', booking);
      
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      console.error('QR lookup failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process QR code';
      setAppState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const handleQRScanError = (error: string) => {
    setAppState(prev => ({ ...prev, isLoading: false }));
    handleError(`QR Scan Error: ${error}`);
  };

  const handleManualSearchRequest = () => {
    navigateToScreen('search');
  };

  // Manual Search handlers
  const handleSearchResult = (bookings: BookingRecord[]) => {
    console.log('Search results:', bookings);
  };

  const handleSearchError = (error: string) => {
    handleError(`Search Error: ${error}`);
  };

  const handleBookingSelect = (booking: BookingRecord) => {
    navigateToScreen('attendee-info', booking);
  };

  // Attendee Info handlers
  const handleCheckInRequest = (actualGuests: number, arrivalTime?: string) => {
    if (appState.selectedBooking) {
      navigateToScreen('checkin-form');
    }
  };

  // Check-in Form handlers
  const handleCheckInSubmit = async (actualGuests: number, arrivalTime: string) => {
    if (!appState.selectedBooking) return;
    
    setAppState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Convert the datetime-local string to ISO string for database
      const arrivalDate = new Date(arrivalTime);
      const timestamp = arrivalDate.toISOString();
      
      console.log('Checking in with:', { actualGuests, arrivalTime, timestamp });
      
      // Perform actual database check-in
      const result = await checkInAttendee({
        bookingId: appState.selectedBooking.id,
        actualGuests,
        timestamp
      });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      if (!result.success || !result.booking) {
        throw new Error('Check-in failed - no booking data returned');
      }
      
      // Update the selected booking with the latest data
      setAppState(prev => ({ 
        ...prev, 
        selectedBooking: result.booking!,
        isLoading: false 
      }));
      
      navigateToScreen('success');
      
    } catch (error) {
      console.error('Check-in failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to check in attendee. Please try again.';
      setAppState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const handleCheckInCancel = () => {
    navigateToScreen('attendee-info');
  };

  // Success screen handler
  const handleSuccessComplete = () => {
    setAppState({
      currentScreen: 'scanner',
      selectedBooking: null,
      error: null,
      isLoading: false,
    });
  };

  // Back navigation handler
  const handleBack = () => {
    switch (appState.currentScreen) {
      case 'search':
        navigateToScreen('scanner');
        break;
      case 'attendee-info':
        navigateToScreen('search');
        break;
      case 'checkin-form':
        navigateToScreen('attendee-info');
        break;
      case 'success':
        navigateToScreen('scanner');
        break;
      default:
        break;
    }
  };

  // Render current screen
  const renderCurrentScreen = () => {
    switch (appState.currentScreen) {
      case 'scanner':
        return (
          <QRScannerComponent
            onScanSuccess={handleQRScanSuccess}
            onScanError={handleQRScanError}
            onManualSearchRequest={handleManualSearchRequest}
          />
        );

      case 'search':
        return (
          <ManualSearchComponent
            onSearchResult={handleSearchResult}
            onSearchError={handleSearchError}
            onBookingSelect={handleBookingSelect}
            onCancel={() => navigateToScreen('scanner')}
          />
        );

      case 'attendee-info':
        return appState.selectedBooking ? (
          <AttendeeInfoComponent
            booking={appState.selectedBooking}
            onCheckIn={handleCheckInRequest}
            onCancel={handleBack}
          />
        ) : null;

      case 'checkin-form':
        return appState.selectedBooking ? (
          <CheckInFormComponent
            expectedGuests={appState.selectedBooking.num_guests}
            currentActualGuests={appState.selectedBooking.actual_num_guests}
            onSubmit={handleCheckInSubmit}
            onCancel={handleCheckInCancel}
          />
        ) : null;

      case 'success':
        return appState.selectedBooking ? (
          <CheckInSuccessComponent
            booking={appState.selectedBooking}
            onComplete={handleSuccessComplete}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Network Status Indicator */}
      <NetworkStatusIndicator />
      
      {/* Header with navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Back button */}
            {appState.currentScreen !== 'scanner' && (
              <button
                onClick={handleBack}
                className="flex items-center text-blue-600 hover:text-blue-800 transition-colors min-h-[44px] min-w-[44px] justify-center"
                aria-label="Go back"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            
            {/* Title */}
            <h1 className="text-lg font-semibold text-gray-900 flex-1 text-center">
              {appState.currentScreen === 'scanner' && 'QR Check-in'}
              {appState.currentScreen === 'search' && 'Manual Search'}
              {appState.currentScreen === 'attendee-info' && 'Attendee Info'}
              {appState.currentScreen === 'checkin-form' && 'Check-in'}
              {appState.currentScreen === 'success' && 'Success'}
            </h1>
            
            {/* Placeholder for right side actions */}
            <div className="w-11"></div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 pb-safe">
        <div className="max-w-md mx-auto px-4 py-6">
          {/* Error Display */}
          {appState.error && (
            <div className="mb-6">
              <ErrorDisplay
                error={appState.error}
                onDismiss={clearError}
                onRetry={() => {
                  clearError();
                  // Retry logic would go here
                }}
              />
            </div>
          )}

          {/* Loading State */}
          {appState.isLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Processing...</p>
              </div>
            </div>
          )}

          {/* Current Screen Content */}
          {renderCurrentScreen()}
        </div>
      </main>
    </div>
  );
}