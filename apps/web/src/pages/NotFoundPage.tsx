import { Link } from "react-router";
import { usePageTitle } from "../layout/usePageTitle";
import { EmptyState } from "../ui/components";

export function NotFoundPage() {
  usePageTitle("Seite nicht gefunden");
  return (
    <EmptyState title="Diese Seite gibt es nicht">
      <Link to="/">Zur Startseite</Link>
    </EmptyState>
  );
}
