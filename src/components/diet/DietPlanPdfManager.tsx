import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, ExternalLink, Loader2, Replace } from 'lucide-react';
import {
  usePlanDietPlanFiles,
  useUploadDietPlanFile,
  useDeleteDietPlanFile,
  useReplaceDietPlanFile,
  getDietPlanFileSignedUrl,
  type DietPlanFile,
} from '@/hooks/useDietPlanFiles';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  planId: string;
  clientId: string;
}

export const DietPlanPdfManager = ({ planId, clientId }: Props) => {
  const { data: files = [], isLoading } = usePlanDietPlanFiles(planId);
  const uploadFile = useUploadDietPlanFile();
  const replaceFile = useReplaceDietPlanFile();
  const deleteFile = useDeleteDietPlanFile();

  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const validate = (file: File) => {
    if (file.type && file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return false;
    }
    return true;
  };

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validate(file)) return;
    await uploadFile.mutateAsync({ clientId, dietPlanId: planId, file });
    if (addInputRef.current) addInputRef.current.value = '';
  };

  const handleReplacePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = files.find((f) => f.id === replacingId);
    if (!file || !target) {
      setReplacingId(null);
      return;
    }
    if (!validate(file)) {
      setReplacingId(null);
      return;
    }
    await replaceFile.mutateAsync({ existing: target, newFile: file });
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    setReplacingId(null);
  };

  const handleView = async (file: DietPlanFile) => {
    setViewingId(file.id);
    try {
      const url = await getDietPlanFileSignedUrl(file.file_path);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to open PDF');
    } finally {
      setViewingId(null);
    }
  };

  const handleDelete = (file: DietPlanFile) => {
    if (confirm(`Remove "${file.file_name}"?`)) deleteFile.mutate(file);
  };

  return (
    <div className="space-y-2 w-full">
      <input
        ref={addInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleAdd}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleReplacePick}
      />

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading PDFs...</div>
      ) : files.length === 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => addInputRef.current?.click()}
          disabled={uploadFile.isPending}
        >
          {uploadFile.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          Attach PDF
        </Button>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant="outline" className="gap-1 text-xs max-w-[200px] truncate">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{f.file_name}</span>
              </Badge>
              {f.is_published ? (
                <Badge className="bg-success hover:bg-success text-success-foreground text-[10px] py-0 px-1.5">
                  Client-visible
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                  Not published
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {format(new Date(f.created_at), 'dd MMM yyyy')}
              </span>
              <Button variant="outline" size="sm" onClick={() => handleView(f)} disabled={viewingId === f.id}>
                {viewingId === f.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setReplacingId(f.id);
                  replaceInputRef.current?.click();
                }}
                disabled={replaceFile.isPending}
              >
                <Replace className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(f)}
                disabled={deleteFile.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => addInputRef.current?.click()}
              disabled={uploadFile.isPending}
              className="text-xs"
            >
              {uploadFile.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              Add another PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
