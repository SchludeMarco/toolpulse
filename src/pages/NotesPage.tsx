import { useState } from "react";
import { useNotes } from "../hooks/useNotes";
import { formatDateDe } from "../lib/time";
import type { Note } from "../types";

function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: Note;
  onUpdate: (id: string, fields: Partial<Pick<Note, "title" | "content">>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  const save = () => {
    onUpdate(note.id, { title, content });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-[var(--amber)]/60 bg-[var(--surface)] p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="focus-ring w-full rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium"
          placeholder="Titel"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="focus-ring mt-2 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
          placeholder="Deine Idee …"
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={save}
            className="focus-ring rounded-md bg-[var(--amber)] px-3.5 py-1.5 text-sm font-medium text-[#0E1116] hover:opacity-90"
          >
            Speichern
          </button>
          <button
            onClick={() => {
              setTitle(note.title);
              setContent(note.content);
              setEditing(false);
            }}
            className="focus-ring rounded-md border border-[var(--line)] px-3.5 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{note.title}</h3>
        <span className="shrink-0 whitespace-nowrap text-xs text-[var(--text-muted)]">
          {formatDateDe(note.updatedAt)}
        </span>
      </div>
      {note.content && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-muted)]">
          {note.content}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setEditing(true)}
          className="focus-ring rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Bearbeiten
        </button>
        <button
          onClick={() => onDelete(note.id)}
          className="focus-ring rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--danger)] hover:opacity-80"
        >
          Löschen
        </button>
      </div>
    </div>
  );
}

export function NotesPage() {
  const { notes, addNote, updateNote, deleteNote, loading } = useNotes();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !content.trim()) return;
    addNote(title, content);
    setTitle("");
    setContent("");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="display text-2xl font-semibold tracking-tight">
        Notizblock
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Eigene Ideen festhalten — z.B. welches Tool aus dem Feed du selbst
        ausprobieren oder für ein Projekt nutzen willst. Wird auf diesem Gerät
        gespeichert (bzw. in deinem Konto, sobald angemeldet).
      </p>

      <form
        onSubmit={submit}
        className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          className="focus-ring w-full rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="Deine Idee …"
          className="focus-ring mt-2 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="focus-ring mt-3 rounded-md bg-[var(--amber)] px-3.5 py-1.5 text-sm font-medium text-[#0E1116] hover:opacity-90"
        >
          Notiz hinzufügen
        </button>
      </form>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--text-muted)]">Lade Notizen …</p>
      ) : notes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Noch keine Notizen — leg oben deine erste Idee an.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdate={updateNote}
              onDelete={deleteNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
