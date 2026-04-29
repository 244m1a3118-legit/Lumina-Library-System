import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onResult: (decodedText: string) => void;
  onError?: (errorMessage: string) => void;
  id?: string;
}

export const BarcodeScanner = ({ onResult, onError, id = "reader" }: BarcodeScannerProps) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const isDismounted = useRef(false);

  // Keep callback refs up to date without triggering re-renders
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  }, [onResult, onError]);

  useEffect(() => {
    isDismounted.current = false;

    // A small delay ensures that React 18 StrictMode's immediate Mount -> Unmount 
    // prevents the first instance from spinning up the camera asynchronously,
    // which avoids zombie camera processes locking the feed.
    const initTimer = setTimeout(() => {
      if (isDismounted.current) return;

      const element = document.getElementById(id);
      if (element) {
          element.innerHTML = "";
      }

      const scanner = new Html5QrcodeScanner(
        id,
        { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
        /* verbose= */ false
      );
      
      scannerRef.current = scanner;

      scanner.render(
        (text) => {
          if (onResultRef.current) onResultRef.current(text);
        },
        (error) => {
          if (onErrorRef.current) onErrorRef.current(error);
        }
      );
    }, 100);

    return () => {
      isDismounted.current = true;
      clearTimeout(initTimer);
      
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        try {
          s.clear().catch(() => {
              // Ignore teardown timeouts when component rapidly unmounts
          });
        } catch(e) { }
      }
    };
  }, [id]);

  return <div id={id} style={{ width: '100%', maxWidth: '400px', margin: '0 auto', borderRadius: '8px', overflow: 'hidden' }}></div>;
};
