'use client';

import React, { useRef, useState } from 'react';

export default function CameraTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const addDiagnostic = (message: string) => {
    console.log(message);
    setDiagnostics(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const checkEnvironment = () => {
    const checks = [];
    
    // Check if we're on HTTPS or localhost
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    checks.push(`Secure context: ${isSecure ? '✅' : '❌'} (${location.protocol}//${location.hostname})`);
    
    // Check MediaDevices API
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    checks.push(`MediaDevices API: ${hasMediaDevices ? '✅' : '❌'}`);
    
    // Check platform
    checks.push(`Platform: ${navigator.platform}`);
    checks.push(`User Agent: ${navigator.userAgent.substring(0, 100)}...`);
    
    setDiagnostics(checks);
  };

  const startCamera = async () => {
    try {
      setError(null);
      addDiagnostic('Starting camera...');
      
      // Try with basic constraints first
      addDiagnostic('Requesting camera with basic constraints...');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      
      addDiagnostic(`Camera stream obtained: ${mediaStream.getVideoTracks().length} video tracks`);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        addDiagnostic('Video stream assigned to element');
        
        await videoRef.current.play();
        setStream(mediaStream);
        setIsActive(true);
        addDiagnostic('Video element playing successfully');
        
        // Get video track info
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          addDiagnostic(`Video settings: ${settings.width}x${settings.height}, facing: ${settings.facingMode || 'unknown'}`);
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown camera error';
      setError(errorMsg);
      addDiagnostic(`❌ Camera error: ${errorMsg}`);
      
      if (err instanceof Error) {
        addDiagnostic(`Error name: ${err.name}`);
        if (err.name === 'NotAllowedError') {
          addDiagnostic('💡 This usually means camera permission was denied');
        } else if (err.name === 'NotFoundError') {
          addDiagnostic('💡 No camera device found');
        } else if (err.name === 'NotReadableError') {
          addDiagnostic('💡 Camera is in use by another application');
        }
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
      console.log('Camera stopped');
    }
  };

  return (
    <div className="p-4 max-w-4xl">
      <h2 className="text-xl font-bold mb-4">Camera Diagnostic Test</h2>
      
      <div className="mb-4 flex gap-2 flex-wrap">
        <button
          onClick={checkEnvironment}
          className="bg-gray-500 text-white px-4 py-2 rounded"
        >
          Check Environment
        </button>
        
        <button
          onClick={startCamera}
          disabled={isActive}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Start Camera
        </button>
        
        <button
          onClick={stopCamera}
          disabled={!isActive}
          className="bg-red-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Stop Camera
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Video Feed</h3>
          <video
            ref={videoRef}
            className="w-full max-w-md border rounded bg-black"
            playsInline
            muted
            autoPlay
          />
          <p className="text-sm mt-2">Status: {isActive ? '✅ Camera Active' : '⭕ Camera Inactive'}</p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Diagnostics Log</h3>
          <div className="bg-gray-100 p-3 rounded text-xs font-mono h-64 overflow-y-auto">
            {diagnostics.length === 0 ? (
              <p className="text-gray-500">Click "Check Environment" to start diagnostics</p>
            ) : (
              diagnostics.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-blue-50 p-4 rounded">
        <h4 className="font-semibold mb-2">macOS Troubleshooting Steps:</h4>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>Open System Preferences → Security & Privacy → Camera</li>
          <li>Make sure your browser (Safari/Chrome/Firefox) has camera access enabled</li>
          <li>Close any other applications that might be using the camera (Zoom, Teams, etc.)</li>
          <li>Try refreshing this page</li>
          <li>If using Safari, try Chrome or Firefox instead</li>
          <li>Make sure you're accessing via HTTPS or localhost (check URL above)</li>
        </ol>
      </div>
    </div>
  );
}