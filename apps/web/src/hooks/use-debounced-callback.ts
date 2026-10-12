import * as React from "react";

import { useCallbackRef } from "@/hooks/use-callback-ref";

type DebouncedCallback<T extends (...args: never[]) => unknown> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
};

export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number,
) {
  const handleCallback = useCallbackRef(callback);
  const debounceTimerRef = React.useRef(0);
  const cancel = React.useCallback(() => {
    window.clearTimeout(debounceTimerRef.current);
  }, []);

  React.useEffect(() => cancel, [cancel]);

  const debouncedCallback = React.useCallback(
    (...args: Parameters<T>) => {
      cancel();
      debounceTimerRef.current = window.setTimeout(() => handleCallback(...args), delay);
    },
    [cancel, handleCallback, delay],
  );

  return React.useMemo(
    () => Object.assign(debouncedCallback, { cancel }) as DebouncedCallback<T>,
    [cancel, debouncedCallback],
  );
}
