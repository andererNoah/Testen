import { useEffect } from "react";

/** Each page sets a unique document title (WCAG 2.4.2). */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} – [PRODUKTNAME]`;
  }, [title]);
}
