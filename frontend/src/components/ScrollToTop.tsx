import { useEffect } from "react";
import { useLocation } from "react-router";

/** Restores the document to the top whenever the active route changes. */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
