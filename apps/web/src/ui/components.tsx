import { AlertTriangle, CheckCircle2, ChevronDown, CircleAlert, Clock, Info, Search } from "lucide-react";
import type { ReactNode } from "react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  Dialog,
  FieldError,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  SearchField as AriaSearchField,
  Select,
  SelectValue,
  Text,
  TextField as AriaTextField,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import type { ApiError } from "../api/client";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "secondary", size, className, ...props }: AriaButtonProps & { variant?: Variant; size?: "sm" }) {
  const classes = ["btn", variant !== "secondary" && `btn-${variant}`, size && `btn-${size}`, className].filter(Boolean).join(" ");
  return <AriaButton {...props} className={classes} />;
}

/** Every icon-only action has a visible tooltip and an accessible name (V2). */
export function IconButton({ label, children, ...props }: Omit<AriaButtonProps, "children"> & { label: string; children: ReactNode }) {
  return (
    <TooltipTrigger delay={300}>
      <AriaButton {...props} aria-label={label} className="btn btn-ghost btn-icon">
        {children}
      </AriaButton>
      <Tooltip className="tooltip" offset={6}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  );
}

export function TextField(props: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  description?: string;
  error?: string;
  isRequired?: boolean;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "decimal" | "numeric" | "email";
}) {
  const { label, description, error, placeholder, type, autoFocus, inputMode, ...rest } = props;
  return (
    <AriaTextField {...rest} type={type} isInvalid={!!error} className="field" autoFocus={autoFocus}>
      <Label>
        {label}
        {props.isRequired && <span aria-hidden="true"> *</span>}
      </Label>
      <Input placeholder={placeholder} inputMode={inputMode} />
      {description && (
        <Text slot="description" className="field-description">
          {description}
        </Text>
      )}
      <FieldError className="field-error">{error}</FieldError>
    </AriaTextField>
  );
}

export interface Option {
  id: string;
  label: string;
}

export function SelectField(props: {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
  isRequired?: boolean;
  placeholder?: string;
  description?: string;
}) {
  return (
    <Select
      className="field"
      selectedKey={props.value}
      onSelectionChange={(key) => key !== null && props.onChange(String(key))}
      isInvalid={!!props.error}
      isRequired={props.isRequired}
      placeholder={props.placeholder ?? "Bitte wählen"}
    >
      <Label>
        {props.label}
        {props.isRequired && <span aria-hidden="true"> *</span>}
      </Label>
      <AriaButton className="select-button">
        <SelectValue />
        <ChevronDown size={16} aria-hidden="true" />
      </AriaButton>
      {props.description && (
        <Text slot="description" className="field-description">
          {props.description}
        </Text>
      )}
      <FieldError className="field-error">{props.error}</FieldError>
      <Popover className="popover">
        <ListBox className="listbox" items={props.options}>
          {(o) => (
            <ListBoxItem id={o.id} className="listbox-item" textValue={o.label}>
              {o.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <AriaSearchField aria-label={label} value={value} onChange={onChange} className="search">
      <Search size={16} aria-hidden="true" />
      <Input placeholder={placeholder ?? label} />
    </AriaSearchField>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      {(title || actions) && (
        <div className="spread card-title">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "accent" }) {
  return <span className={`badge${tone ? ` badge-${tone}` : ""}`}>{children}</span>;
}

export type DeadlineStatus = "ok" | "warn" | "critical" | "overdue";
export type Light = "green" | "yellow" | "red";

const STATUS_TEXT: Record<DeadlineStatus, string> = { ok: "Im Plan", warn: "Vorwarnung", critical: "Dringend", overdue: "Überfällig" };
const STATUS_ICON: Record<DeadlineStatus, ReactNode> = {
  ok: <CheckCircle2 size={16} aria-hidden="true" />,
  warn: <Clock size={16} aria-hidden="true" />,
  critical: <AlertTriangle size={16} aria-hidden="true" />,
  overdue: <CircleAlert size={16} aria-hidden="true" />,
};

/** Status never by color alone: icon + text (WCAG 1.4.1, dataviz status rule). */
export function DeadlineStatusBadge({ status }: { status: DeadlineStatus }) {
  return (
    <span className={`status status-${status}`}>
      {STATUS_ICON[status]}
      {STATUS_TEXT[status]}
    </span>
  );
}
export const deadlineStatusText = STATUS_TEXT;

const LIGHT_TEXT: Record<Light, string> = { green: "Vollständig", yellow: "Lücken (empfohlen)", red: "Pflichtangaben fehlen" };
export function TrafficLight({ light, label }: { light: Light; label?: string }) {
  const icon = light === "green" ? <CheckCircle2 size={16} aria-hidden="true" /> : light === "yellow" ? <Clock size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />;
  return (
    <span className={`status status-${light}`}>
      {icon}
      {label ?? LIGHT_TEXT[light]}
    </span>
  );
}

export function Spinner({ label = "Wird geladen" }: { label?: string }) {
  return (
    <div className="row" role="status">
      <div className="spinner" aria-hidden="true" />
      <span className="muted">{label} …</span>
    </div>
  );
}

export function ErrorNotice({ error, title }: { error: unknown; title?: string }) {
  const e = error as Partial<ApiError> & { message?: string };
  return (
    <div className="notice notice-error" role="alert">
      <strong>{title ?? e.title ?? "Fehler"}</strong>
      <div>{e.detail ?? e.message ?? "Unbekannter Fehler"}</div>
      {e.issues && e.issues.length > 0 && (
        <ul>
          {e.issues.map((i) => (
            <li key={`${i.path}:${i.message}`}>
              {i.path ? <code>{i.path}</code> : null} {i.message}
            </li>
          ))}
        </ul>
      )}
      {e.requestId && <div className="small muted">Vorgangsnummer für den Support: {e.requestId}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success" | "error"; children: ReactNode }) {
  const icon = tone === "success" ? <CheckCircle2 size={18} aria-hidden="true" /> : tone === "info" ? <Info size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />;
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
        {icon}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

/** Contextual help per page (V1): short, collapsible, never in the way. */
export function Help({ title = "So funktioniert diese Seite", children }: { title?: string; children: ReactNode }) {
  return (
    <details className="help">
      <summary>{title}</summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
}

export function ModalDialog({
  isOpen,
  onOpenChange,
  title,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="modal-overlay">
      <Modal className="modal">
        <Dialog className="dialog">
          {({ close }) => (
            <>
              <Heading slot="title">{title}</Heading>
              {children(close)}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
