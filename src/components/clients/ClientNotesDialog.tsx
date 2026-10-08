import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  ClientNote,
  useClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
} from '@/hooks/useClientNotes';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

const today = () => new Date().toISOString().split('T')[0];

export const ClientNotesDialog = ({ open, onOpenChange, clientId, clientName }: Props) => {
  const { user } = useAuth();
  const { data: notes = [], isLoading } = useClientNotes(clientId);
  const createNote = useCreateClientNote();
  const updateNote = useUpdateClientNote();
  const deleteNote = useDeleteClientNote();

  const [newDate, setNewDate] = useState(today());
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editText, setEditText] = useState('');

  const handleAdd = async () => {
    if (!newText.trim()) return;
    await createNote.mutateAsync({
      client_id: clientId,
      note_date: newDate || today(),
      note_text: newText.trim(),
      created_by: user?.email ?? null,
    });
    setNewText('');
    setNewDate(today());
  };

  const startEdit = (note: ClientNote) => {
    setEditingId(note.id);
    setEditDate(note.note_date);
    setEditText(note.note_text);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await updateNote.mutateAsync({
      id: editingId,
      client_id: clientId,
      note_date: editDate,
      note_text: editText.trim(),
    });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conversation History — {clientName}</DialogTitle>
        </DialogHeader>

        {/* Add note */}
        <div className="space-y-2 border-b pb-4">
          <div className="flex gap-2">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="What did you discuss with this client?"
            rows={3}
          />
          <Button size="sm" onClick={handleAdd} disabled={!newText.trim() || createNote.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Add Note
          </Button>
        </div>

        {/* Notes list */}
        <div className="space-y-3 pt-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No notes logged yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border bg-card p-3 space-y-1.5">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-40" />
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={saveEdit} disabled={updateNote.isPending}>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {format(new Date(note.note_date), 'dd MMM yyyy')}
                        {note.created_by && <span className="ml-2 text-muted-foreground/70">— {note.created_by}</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(note)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => {
                            if (confirm('Delete this note?')) deleteNote.mutate({ id: note.id, client_id: clientId });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.note_text}</p>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
