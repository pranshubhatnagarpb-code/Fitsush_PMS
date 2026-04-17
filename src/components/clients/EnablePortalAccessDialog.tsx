import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Client } from '@/hooks/useClients';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSuccess?: () => void;
}

export const EnablePortalAccessDialog = ({ open, onOpenChange, client, onSuccess }: Props) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ email: string | null; phone: string | null } | null>(null);

  const reset = () => {
    setPassword('');
    setConfirm('');
    setShow(false);
    setSuccess(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!client) return;
    if (!client.email && !client.phone) {
      toast.error('Client must have an email or phone before enabling portal access.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('enable-portal-access', {
        body: {
          client_id: client.id,
          password,
          email: client.email,
          phone: client.phone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Portal access enabled');
      setSuccess({ email: data?.login?.email ?? null, phone: data?.login?.phone ?? null });
      onSuccess?.();
    } catch (e: any) {
      toast.error('Failed to enable portal access', { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Enable Portal Access
          </DialogTitle>
          <DialogDescription>
            {client ? (
              <>Set a password for <strong>{client.name}</strong>. They'll log in to the PWA using their email or phone with this password.</>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-2">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Portal access is now active.</p>
                  <p>Share these login details with the client:</p>
                  {success.email && <p><strong>Email:</strong> {success.email}</p>}
                  {success.phone && <p><strong>Phone:</strong> {success.phone}</p>}
                  <p className="text-muted-foreground">Password: <em>(the one you just set)</em></p>
                </div>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="text-sm space-y-1 p-3 rounded-md bg-muted">
                <div><span className="text-muted-foreground">Email:</span> {client?.email || <span className="italic">— none —</span>}</div>
                <div><span className="text-muted-foreground">Phone:</span> {client?.phone || <span className="italic">— none —</span>}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="portal-password">Password</Label>
                <div className="relative">
                  <Input
                    id="portal-password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="portal-confirm">Confirm password</Label>
                <Input
                  id="portal-confirm"
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !client}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enabling...</>
                ) : (
                  'Enable & Set Password'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
