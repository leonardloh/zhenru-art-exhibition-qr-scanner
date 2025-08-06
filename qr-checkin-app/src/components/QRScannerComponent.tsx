'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException, ChecksumException, FormatException } from '@zxing/library';

interface QRScannerProps {
  onScanSuccess: (bookingId: string) => void;
  onScanError: (error: string) => void;
  onManualSearchRequest: () => void;
}

interface CameraError {
  type: 'permission' | 'unavailable' | 'unknown';
  message: string;
}

// Utility function to detect macOS
const isMacOS = () => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
         navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
};

// Simple camera test function
const testCameraAccess = async (): Promise<boolean> => {
  try {
    console.log('Testing basic camera access...');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log('Camera access successful, stopping test stream');
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Camera test failed:', error);
    return false;
  }
};

export default function QRScannerComponent({ 
  onScanSuccess, 
  onScanError, 
  onManualSearchRequest 
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Initialize the QR code reader
  useEffect(() => {
    codeReader.current = new BrowserMultiFormatReader();
    return () => {
      stopScanning();
    };
  }, []);

  // Check camera permissions and availability
  const checkCameraPermissions = useCallback(async (): Promise<boolean> => {
    console.log('Checking camera permissions...');
    try {
      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not available');
        setCameraError({
          type: 'unavailable',
          message: 'Camera is not available on this device. Please ensure you\'re using HTTPS or localhost.'
        });
        return false;
      }

      console.log('MediaDevices API available, requesting camera access...');

      // Increase timeout for macOS - it often takes longer to grant permissions
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Camera access timeout')), 20000);
      });

      // Use more flexible camera constraints for better macOS compatibility
      const videoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' }, // Prefer rear camera but allow front
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 }
      };

      // Try with ideal constraints first
      let streamPromise = navigator.mediaDevices.getUserMedia({ 
        video: videoConstraints
      });

      let stream: MediaStream;
      
      try {
        stream = await Promise.race([streamPromise, timeoutPromise]);
      } catch (constraintError) {
        console.warn('Failed with ideal constraints, trying basic constraints:', constraintError);
        
        // Fallback to basic constraints for older macOS/Safari versions
        streamPromise = navigator.mediaDevices.getUserMedia({ 
          video: true // Most basic constraint
        });
        
        stream = await Promise.race([streamPromise, timeoutPromise]);
      }
      
      // Stop the stream immediately after permission check
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      setCameraError(null);
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          const macOSMessage = 'Camera permission denied. Please check System Preferences > Security & Privacy > Camera and ensure your browser has camera access.';
          const genericMessage = 'Camera permission denied. Please allow camera access in your browser settings and refresh the page.';
          
          setCameraError({
            type: 'permission',
            message: isMacOS() ? macOSMessage : genericMessage
          });
        } else if (error.name === 'NotFoundError') {
          setCameraError({
            type: 'unavailable',
            message: 'No camera found on this device'
          });
        } else if (error.name === 'NotReadableError') {
          setCameraError({
            type: 'unavailable',
            message: 'Camera is already in use by another application. Please close other apps using the camera and try again.'
          });
        } else if (error.name === 'OverconstrainedError') {
          setCameraError({
            type: 'unavailable',
            message: 'Camera constraints not supported. Trying with basic settings...'
          });
          // Retry with basic constraints
          setTimeout(() => {
            checkCameraPermissions();
          }, 1000);
          return false;
        } else if (error.message === 'Camera access timeout') {
          const macOSMessage = 'Camera is taking too long to load. This might be due to system permissions. Please check System Preferences > Security & Privacy > Camera.';
          const genericMessage = 'Camera is taking too long to load. Please check your camera permissions and try again.';
          
          setCameraError({
            type: 'unknown',
            message: isMacOS() ? macOSMessage : genericMessage
          });
        } else {
          const macOSMessage = `Unable to access camera: ${error.message}. Please ensure camera permissions are granted in System Preferences > Security & Privacy > Camera.`;
          const genericMessage = `Unable to access camera: ${error.message}. Try refreshing the page or checking browser permissions.`;
          
          setCameraError({
            type: 'unknown',
            message: isMacOS() ? macOSMessage : genericMessage
          });
        }
      }
      
      setHasPermission(false);
      return false;
    }
  }, []);

  // Start QR code scanning
  const startScanning = useCallback(async () => {
    console.log('startScanning called');
    if (!videoRef.current) {
      console.error('Video ref not available - video element not rendered yet');
      setCameraError({
        type: 'unknown',
        message: 'Video element not ready. Please try again in a moment.'
      });
      setIsLoading(false);
      return;
    }

    console.log('Video element is available, proceeding with camera initialization...');

    try {
      setIsLoading(true);
      setIsScanning(true);
      setCameraError(null);

      console.log('Starting camera with basic constraints...');
      
      // Use the same approach as the working camera test
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true // Start with basic constraints that we know work
      });

      console.log('Got camera stream:', stream);
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready and playing
      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error('Video element not available'));
          return;
        }
        
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          videoRef.current!.play()
            .then(() => {
              console.log('Video is playing');
              resolve();
            })
            .catch(reject);
        };
        
        videoRef.current.onerror = (e) => {
          console.error('Video error:', e);
          reject(new Error('Video failed to load'));
        };
      });

      console.log('Video is ready, showing camera interface...');
      
      // Set loading to false immediately so the camera interface shows
      setIsLoading(false);

      // Now initialize ZXing scanner in the background
      if (!codeReader.current) {
        console.error('QR code reader not initialized');
        return;
      }

      console.log('Setting up QR detection timeout...');
      
      // Give the video a moment to stabilize before starting QR detection
      setTimeout(async () => {
        console.log('QR detection timeout fired, starting initialization...');
        try {
          console.log('Starting QR code detection...');
          
          // Use decodeFromVideoDevice for better continuous scanning
          await codeReader.current!.decodeFromVideoDevice(
            undefined, // Let ZXing choose the best camera
            videoRef.current!,
            (result, error) => {
              if (result) {
                const scannedText = result.getText();
                console.log('QR Code detected:', scannedText);
                
                // Extract booking ID from QR code
                if (scannedText && scannedText.trim()) {
                  console.log('Valid QR code found, calling onScanSuccess');
                  onScanSuccess(scannedText.trim());
                  stopScanning();
                } else {
                  console.warn('QR code is empty or invalid');
                  onScanError('QR code does not contain valid booking information');
                }
              }
              
              if (error) {
                // Only log errors that aren't common scanning errors
                if (!(error instanceof NotFoundException)) {
                  console.warn('QR scanning error:', error.name, error.message);
                  
                  if (error instanceof ChecksumException || error instanceof FormatException) {
                    // These are common when QR code is not fully visible or clear
                    return;
                  }
                  
                  // Log other errors for debugging
                  console.error('Unexpected QR scanning error:', error);
                }
              }
            }
          );
          
          console.log('QR scanner initialized successfully - now scanning continuously');
        } catch (zxingError) {
          console.error('ZXing initialization error:', zxingError);
          console.warn('QR detection failed, but camera is working. User can use manual search.');
          
          // Try alternative initialization method
          console.log('Trying alternative QR scanner initialization...');
          try {
            // Alternative: use decodeFromVideoElement with continuous scanning
            const scanFrame = async () => {
              if (!codeReader.current || !videoRef.current) return;
              
              try {
                const result = await codeReader.current.decodeFromVideoElement(videoRef.current);
                if (result) {
                  const scannedText = result.getText();
                  console.log('QR Code detected (alternative method):', scannedText);
                  if (scannedText && scannedText.trim()) {
                    onScanSuccess(scannedText.trim());
                    return;
                  }
                }
              } catch (scanError) {
                // Ignore NotFoundException - it's normal when no QR code is visible
                if (!(scanError instanceof NotFoundException)) {
                  console.warn('Alternative scan error:', scanError);
                }
              }
              
              // Continue scanning
              setTimeout(scanFrame, 100); // Scan every 100ms
            };
            
            scanFrame();
            console.log('Alternative QR scanner started');
          } catch (altError) {
            console.error('Alternative QR scanner also failed:', altError);
          }
        }
      }, 1000); // Wait 1 second for video to stabilize
      
    } catch (error) {
      console.error('Failed to start scanning:', error);
      setIsScanning(false);
      setIsLoading(false);
      
      if (error instanceof Error) {
        let errorMessage = `Failed to start camera: ${error.message}`;
        
        if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
          errorMessage = 'Camera permission denied. Please check your browser and macOS system permissions.';
        } else if (error.message.includes('NotReadableError')) {
          errorMessage = 'Camera is in use by another application. Please close other camera apps and try again.';
        }
        
        onScanError(errorMessage);
      } else {
        onScanError('Failed to start camera. Please check your camera permissions and try again.');
      }
    }
  }, [onScanSuccess, onScanError]);

  // Stop QR code scanning
  const stopScanning = useCallback(() => {
    console.log('Stopping scanner...');
    
    if (codeReader.current) {
      codeReader.current.reset();
    }
    
    // Stop video stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    console.log('Scanner stopped');
  }, []);

  // Request camera permission with retry logic
  const requestPermission = useCallback(async () => {
    setRetryCount(0);
    setCameraError(null);
    setIsLoading(true);
    
    // Small delay to ensure any UI updates are processed
    setTimeout(() => {
      startScanning();
    }, 100);
  }, [startScanning]);

  // Retry camera initialization with exponential backoff
  const retryCamera = useCallback(async () => {
    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      setRetryCount(prev => prev + 1);
      setCameraError(null);
      setIsLoading(true);
      
      setTimeout(() => {
        startScanning();
      }, delay);
    }
  }, [retryCount, startScanning]);

  // Initialize scanning on component mount - wait for video element to be available
  useEffect(() => {
    console.log('QRScannerComponent mounted, waiting for video element...');
    
    // Use a small delay to ensure the video element is rendered
    const initTimer = setTimeout(() => {
      if (videoRef.current) {
        console.log('Video element found, starting camera initialization...');
        startScanning();
      } else {
        console.error('Video element still not available after delay');
        setCameraError({
          type: 'unknown',
          message: 'Failed to initialize video element. Please refresh the page.'
        });
        setIsLoading(false);
      }
    }, 100); // Small delay to ensure DOM is ready

    return () => clearTimeout(initTimer);
  }, []); // Remove startScanning dependency to avoid infinite loops

  // Render camera error state
  const renderCameraError = () => {
    if (!cameraError) return null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-100 rounded-xl p-6 landscape-compact">
        <div className="text-6xl mb-4">
          {cameraError.type === 'permission' ? '📷' : '❌'}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">
          {cameraError.type === 'permission' ? 'Camera Permission Required' : 'Camera Unavailable'}
        </h3>
        <p className="text-gray-600 text-center mb-6 leading-relaxed max-w-sm">
          {cameraError.message}
        </p>
        
        {/* Troubleshooting tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md">
          <h4 className="font-semibold text-blue-900 mb-2">
            {isMacOS() ? 'macOS Troubleshooting:' : 'Troubleshooting Tips:'}
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {isMacOS() ? (
              <>
                <li>• Open System Preferences → Security & Privacy → Camera</li>
                <li>• Enable camera access for your browser (Safari/Chrome)</li>
                <li>• Make sure you're using HTTPS or localhost</li>
                <li>• Close other apps that might be using the camera</li>
                <li>• Try refreshing the page and allowing permissions again</li>
                <li>• If using Safari, try Chrome or Firefox instead</li>
              </>
            ) : (
              <>
                <li>• Make sure you're using HTTPS or localhost</li>
                <li>• Check browser camera permissions</li>
                <li>• Allow camera access when prompted</li>
                <li>• Try refreshing the page</li>
                <li>• Close other apps using the camera</li>
              </>
            )}
          </ul>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button
            onClick={requestPermission}
            className="btn-primary touch-target-comfortable px-6 py-3 rounded-lg font-medium text-lg"
          >
            {cameraError.type === 'permission' ? 'Allow Camera Access' : 'Try Again'}
          </button>
          
          {retryCount > 0 && retryCount < maxRetries && (
            <button
              onClick={retryCamera}
              className="btn-secondary touch-target-comfortable px-6 py-3 rounded-lg font-medium text-lg"
            >
              Retry ({retryCount}/{maxRetries})
            </button>
          )}
          
          <button
            onClick={async () => {
              console.log('Testing camera access...');
              const canAccess = await testCameraAccess();
              console.log('Camera test result:', canAccess);
              if (canAccess) {
                alert('Camera access works! The issue might be with the QR scanner library.');
              } else {
                alert('Camera access failed. Check browser console for details.');
              }
            }}
            className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium text-lg hover:bg-yellow-700 transition-colors touch-target-comfortable"
          >
            Test Camera
          </button>
          
          <button
            onClick={onManualSearchRequest}
            className="btn-secondary touch-target-comfortable px-6 py-3 rounded-lg font-medium text-lg"
          >
            Search Manually Instead
          </button>
        </div>
      </div>
    );
  };

  // Render loading state
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] bg-gray-100 rounded-xl landscape-compact">
      <div className="spinner h-12 w-12 mb-4"></div>
      <p className="text-gray-600 text-lg mb-2">Starting camera...</p>
      <p className="text-gray-500 text-sm text-center max-w-sm">
        If this takes too long, check your browser permissions or try manual search
      </p>
      <button
        onClick={onManualSearchRequest}
        className="mt-4 text-blue-600 hover:text-blue-800 underline text-sm"
      >
        Use manual search instead
      </button>
    </div>
  );

  // Render camera interface
  const renderCamera = () => (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full aspect-video object-cover rounded-xl bg-black landscape-compact"
        playsInline
        muted
      />
      
      {/* QR Code scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="border-2 border-white border-dashed w-48 h-48 rounded-xl flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-3xl mb-2">📱</div>
            <p className="text-sm font-medium">Position QR code here</p>
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
        <button
          onClick={stopScanning}
          disabled={!isScanning}
          className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 touch-target-comfortable text-sm"
        >
          Stop
        </button>
        
        <button
          onClick={onManualSearchRequest}
          className="btn-secondary px-4 py-2 rounded-lg font-medium transition-colors touch-target-comfortable text-sm"
        >
          Manual Search
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan QR Code</h2>
        <p className="text-gray-600 text-base leading-relaxed">
          Point your camera at the attendee&apos;s QR code to check them in
        </p>
      </div>
      
      {/* Always render the video element, but hide it when not needed */}
      <div className={`relative ${isLoading || cameraError ? 'hidden' : ''}`}>
        <video
          ref={videoRef}
          className="w-full aspect-video object-cover rounded-xl bg-black landscape-compact"
          playsInline
          muted
        />
        
        {/* QR Code scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-white border-dashed w-48 h-48 rounded-xl flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-3xl mb-2">📱</div>
              <p className="text-sm font-medium">Position QR code here</p>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
          <button
            onClick={stopScanning}
            disabled={!isScanning}
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 touch-target-comfortable text-sm"
          >
            Stop
          </button>
          
          <button
            onClick={onManualSearchRequest}
            className="btn-secondary px-4 py-2 rounded-lg font-medium transition-colors touch-target-comfortable text-sm"
          >
            Manual Search
          </button>
        </div>
      </div>
      
      {/* Show loading or error states */}
      {isLoading && renderLoading()}
      {cameraError && renderCameraError()}
      
      {isScanning && !isLoading && !cameraError && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 leading-relaxed">
            Camera is active. Position the QR code within the frame.
          </p>
        </div>
      )}
    </div>
  );
}