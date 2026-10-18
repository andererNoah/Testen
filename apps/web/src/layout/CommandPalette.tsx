import { useQuery } from "@tanstack/react-query";
import { Building2, CornerDownLeft, Search, User } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Autocomplete, Dialog, Header, Input, Menu, MenuItem, MenuSection, Modal, ModalOverlay, SearchField, useFilter } from "react-aria-components";
import { useNavigate } from "react-router";
import { api, unwrap } from "../api/client";
import { useCan } from "../api/queries";
import { PROPERTY_KIND } from "../lib/labels";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  to: string;
}

/**
 * Befehlspalette (Produktprinzip „schnell für Profis“): jumps to pages, objects and persons
 * with the keyboard; every frequent task is ≤ 3 interactions away.
 */
export function CommandPalette({ isOpen, onOpenChange, nav }: { isOpen: boolean; onOpenChange: (v: boolean) => void; nav: Array<{ to: string; label: string; icon: ReactNode }> }) {
  const navigate = useNavigate();
  const can = useCan();
  const [text, setText] = useState("");
  const { contains } = useFilter({ sensitivity: "base" });
  const term = text.trim();

  const properties = useQuery({
    queryKey: ["palette", "properties"],
    queryFn: () => unwrap(api.GET("/v1/properties", { params: { query: {} } })),
    enabled: isOpen && can("masterdata.read"),
    staleTime: 30_000,
  });
  const persons = useQuery({
    queryKey: ["palette", "persons", term],
    queryFn: () => unwrap(api.GET("/v1/persons", { params: { query: { q: term, limit: 8 } } })),
    enabled: isOpen && term.length >= 2 && can("persons.read"),
  });

  const actions: Command[] = [
    ...nav.map((n) => ({ id: `nav:${n.to}`, label: n.label, hint: "Seite", icon: n.icon, to: n.to })),
    ...(can("import.run") ? [{ id: "act:import", label: "Daten importieren", hint: "Aktion", to: "/import" }] : []),
    ...(can("persons.write") ? [{ id: "act:person", label: "Person anlegen", hint: "Aktion", to: "/personen?neu=1" }] : []),
    ...(can("tenant.admin") ? [{ id: "act:property", label: "Objekt anlegen", hint: "Aktion", to: "/objekte?neu=1" }] : []),
  ].filter((c) => !term || contains(c.label, term));

  const propertyCommands: Command[] = (properties.data?.items ?? [])
    .filter((p) => !term || contains(`${p.code} ${p.name} ${p.city ?? ""}`, term))
    .slice(0, 8)
    .map((p) => ({ id: `p:${p.id}`, label: `${p.code} · ${p.name}`, hint: PROPERTY_KIND[p.kind], icon: <Building2 size={16} aria-hidden="true" />, to: `/objekte/${p.id}` }));
  const personCommands: Command[] = (persons.data?.items ?? []).map((p) => ({
    id: `pe:${p.id}`,
    label: p.displayName,
    hint: p.city ?? "Person",
    icon: <User size={16} aria-hidden="true" />,
    to: `/personen/${p.id}`,
  }));

  const sections = [
    { id: "actions", title: "Seiten und Aktionen", items: actions },
    { id: "properties", title: "Objekte", items: propertyCommands },
    { id: "persons", title: "Personen", items: personCommands },
  ].filter((s) => s.items.length > 0);

  const all = sections.flatMap((s) => s.items);
  const close = () => {
    onOpenChange(false);
    setText("");
  };

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(v) => (v ? onOpenChange(true) : close())} isDismissable className="modal-overlay">
      <Modal className="modal">
        <Dialog className="palette" aria-label="Suchen und Befehle">
          <Autocomplete inputValue={text} onInputChange={setText} filter={() => true}>
            <SearchField aria-label="Suchbegriff" className="search" autoFocus>
              <Search size={18} aria-hidden="true" />
              <Input placeholder="Objekt, Person oder Seite suchen …" />
            </SearchField>
            <Menu
              className="palette-menu"
              aria-label="Treffer"
              items={sections}
              renderEmptyState={() => <div className="empty small">Keine Treffer für „{term}“.</div>}
              onAction={(key) => {
                const cmd = all.find((c) => c.id === key);
                if (cmd) {
                  close();
                  navigate(cmd.to);
                }
              }}
            >
              {(section) => (
                <MenuSection id={section.id}>
                  <Header className="palette-section-title">{section.title}</Header>
                  {section.items.map((c) => (
                    <MenuItem key={c.id} id={c.id} textValue={c.label} className="palette-item">
                      {c.icon}
                      <span>{c.label}</span>
                      <span className="muted small">{c.hint}</span>
                    </MenuItem>
                  ))}
                </MenuSection>
              )}
            </Menu>
          </Autocomplete>
          <div className="small muted row" style={{ marginTop: 8 }}>
            <CornerDownLeft size={14} aria-hidden="true" /> öffnen · ↑↓ wählen · Esc schließen
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
