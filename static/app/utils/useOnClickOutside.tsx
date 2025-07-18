import {useLayoutEffect} from 'react';

// hook from https://usehooks.com/useOnClickOutside/
function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null> | T | null,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useLayoutEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref) {
        return;
      }
      let el: T | null;
      if ('current' in ref) {
        el = ref.current;
      } else {
        el = ref;
      }

      // Do nothing if clicking ref's element or descendent elements
      if (!el || el.contains(event.target as Node)) {
        return;
      }

      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export default useOnClickOutside;
