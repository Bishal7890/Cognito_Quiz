// hooks/useTimer.ts
import { useEffect, useRef, useState } from "react";

export default function useTimer(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset function
  const reset = () => {
    clearInterval(intervalRef.current as NodeJS.Timeout);
    setRemaining(seconds);
    if (active) start();
  };

  // Internal function to start timer
  const start = () => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current as NodeJS.Timeout);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Effect: restart when `seconds` or `active` changes
  useEffect(() => {
    clearInterval(intervalRef.current as NodeJS.Timeout);
    setRemaining(seconds);
    if (active) start();
    return () => clearInterval(intervalRef.current as NodeJS.Timeout);
  }, [seconds, active]);

  return { remaining, reset };
}
