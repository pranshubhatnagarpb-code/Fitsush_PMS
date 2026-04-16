import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { useUploadDietPlanPdf, useDeleteDietPlanPdf, getSignedPdfUrl } from '@/hooks/useDietPlanPdf';
import { toast } from 'sonner';

interface Props {
  planId: string;
  clientId: string;
  pdfFilePath: string | null;
  pdfFileName: string | null;
  pdfUploadedAt: string | null;
}

export const DietPlanPdfManager = ({ planId, clientId, pdfFilePath, pdfFileName, pdfUploadedAt }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPdf = useUploadDietPlanPdf();
  const deletePdf = useDeleteDietPlanPdf();
  const [viewing, setViewing] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }
    await uploadPdf.mutateAsync({ planId, clientId, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleView = async () => {
    if (!pdfFilePath) return;
    setViewing(true);
    try {
      const url = await getSignedPdfUrl(pdfFilePath);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to open PDF');
    } finally {
      setViewing(false);
    }
  };

  const handleDelete = () => {
    if (!pdfFilePath) return;
    if (confirm('Remove attached PDF?')) {
      deletePdf.mutate({ planId, filePath: pdfFilePath });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />

      {pdfFilePath ? (
        <>
          <Badge variant="outline" className="gap-1 text-xs">
            <FileText className="h-3 w-3" />
            {pdfFileName || 'PDF'}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleView} disabled={viewing}>
            {viewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
            <span className="ml-1">View</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadPdf.isPending}>
            {uploadPdf.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            <span className="ml-1">Replace</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deletePdf.isPending} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadPdf.isPending}>
          {uploadPdf.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
          Attach PDF
        </Button>
      )}
    </div>
  );
};
