import { Download, FileText, Upload } from "lucide-react";
import { useState } from "react";
import { DropZone, FileTrigger } from "react-aria-components";
import { download, upload } from "../api/client";
import { type DocumentItem, useCan, useDocuments, useInvalidateAll } from "../api/queries";
import { formatDate } from "../lib/format";
import { DOCUMENT_CATEGORY, documentCategoryOptions } from "../lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, ModalDialog, SelectField, Spinner, TextField } from "../ui/components";

type EntityType = "property" | "building" | "unit" | "person" | "technical_asset" | "meter";

function size(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Akte (V24): documents of one entity; upload files them there automatically. */
export function DocumentsPanel({ entityType, entityId, propertyId }: { entityType: EntityType; entityId: string; propertyId?: string }) {
  const can = useCan();
  const docs = useDocuments(entityType === "property" ? { propertyId: entityId } : { entityType, entityId });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small" style={{ margin: 0 }}>
          Jedes Dokument liegt revisionssicher mit Prüfsumme und Versionen in einer oder mehreren Akten.
        </p>
        {can("documents.write") && (
          <Button variant="primary" onPress={() => setOpen(true)}>
            <Upload size={16} aria-hidden="true" />
            Dokument ablegen
          </Button>
        )}
      </div>
      {docs.isPending && <Spinner />}
      {docs.isError && <ErrorNotice error={docs.error} />}
      {error ? <ErrorNotice error={error} title="Download fehlgeschlagen" /> : null}
      {docs.data?.items.length === 0 && <EmptyState title="Noch keine Dokumente in dieser Akte" />}
      {docs.data && docs.data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Dokumente</caption>
            <thead>
              <tr>
                <th scope="col">Dokument</th>
                <th scope="col">Art</th>
                <th scope="col">Version</th>
                <th scope="col">Aufbewahren bis</th>
                <th scope="col">
                  <span className="visually-hidden">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.data.items.map((d: DocumentItem) => (
                <tr key={d.id}>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <FileText size={16} aria-hidden="true" />
                      <strong>{d.title}</strong>
                    </div>
                    <div className="small muted">
                      {d.versions[0]?.filename} · {size(d.versions[0]?.sizeBytes ?? 0)} · {formatDate(d.createdAt)}
                    </div>
                  </td>
                  <td>
                    <Badge>{DOCUMENT_CATEGORY[d.category]}</Badge>
                  </td>
                  <td className="num">{d.currentVersion}</td>
                  <td className="num">{d.retentionUntil ? formatDate(d.retentionUntil) : "–"}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`${d.title} herunterladen`}
                      onPress={() => download(`/v1/documents/${d.id}/content`, d.versions[0]?.filename ?? "dokument").catch(setError)}
                    >
                      <Download size={16} aria-hidden="true" />
                      Herunterladen
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <UploadDialog isOpen={open} onClose={() => setOpen(false)} entityType={entityType} entityId={entityId} propertyId={propertyId} />
    </div>
  );
}

function UploadDialog({ isOpen, onClose, entityType, entityId }: { isOpen: boolean; onClose: () => void; entityType: EntityType; entityId: string; propertyId?: string }) {
  const invalidate = useInvalidateAll();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  return (
    <ModalDialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} title="Dokument ablegen">
      {(close) => (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            setBusy(true);
            setError(null);
            const form = new FormData();
            form.set("title", title);
            form.set("category", category);
            form.set("links", JSON.stringify([{ entityType, entityId }]));
            form.set("file", file);
            try {
              await upload("/v1/documents", form);
              await invalidate();
              setFile(null);
              setTitle("");
              close();
            } catch (err) {
              setError(err);
            } finally {
              setBusy(false);
            }
          }}
        >
          <DropZone
            className="dropzone"
            onDrop={async (e) => {
              const item = e.items.find((i) => i.kind === "file");
              if (item && item.kind === "file") pick(await item.getFile());
            }}
          >
            <p style={{ margin: 0 }}>{file ? <strong>{file.name}</strong> : "Datei hierher ziehen oder"}</p>
            <FileTrigger onSelect={(files) => pick(files?.[0])} acceptedFileTypes={[".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".xml", ".txt", ".csv"]}>
              <Button size="sm">Datei auswählen</Button>
            </FileTrigger>
          </DropZone>
          <TextField label="Titel" value={title} onChange={setTitle} isRequired />
          <SelectField label="Art" options={documentCategoryOptions} value={category} onChange={setCategory} description="Rechnungen, Abrechnungen und Schriftverkehr erhalten automatisch eine Aufbewahrungsfrist." />
          {error ? <ErrorNotice error={error} title="Ablage fehlgeschlagen" /> : null}
          <div className="dialog-actions">
            <Button onPress={close}>Abbrechen</Button>
            <Button type="submit" variant="primary" isDisabled={!file || !title || busy}>
              Ablegen
            </Button>
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
