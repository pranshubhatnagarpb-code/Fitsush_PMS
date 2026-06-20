import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Home, ChevronRight, Upload, Link, Pencil, Trash2, Plus, Search, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Row = {
  product_name: string;
  link: string;
  product_name_normalized: string;
  status: 'valid' | 'invalid' | 'duplicate-in-file';
  error?: string;
};

type Product = {
  id: string;
  product_name: string;
  link: string;
  product_name_normalized: string;
  created_at: string;
};

const normalize = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

const getCell = (row: Record<string, any>, keys: string[]) => {
  const normalizedMap = Object.entries(row).reduce<Record<string, any>>((acc, [key, value]) => {
    acc[key.toLowerCase().replace(/[^a-z0-9]+/g, '')] = value;
    return acc;
  }, {});
  for (const key of keys) {
    const direct = row[key];
    if (direct !== undefined && direct !== null) return String(direct).trim();
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const loose = normalizedMap[normalizedKey];
    if (loose !== undefined && loose !== null) return String(loose).trim();
  }
  return '';
};

const AffiliateProductsImport = () => {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editLink, setEditLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('affiliate_products')
        .select('*')
        .order('product_name', { ascending: true });
      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (e: any) {
      toast.error(`Failed to load products: ${e.message}`);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const processRows = (raw: Array<Record<string, any>>) => {
    const seen = new Set<string>();
    const parsed: Row[] = raw.map((r) => {
      const product_name = getCell(r, ['Product name', 'product_name', 'ProductName', 'Product Name', 'name', 'Name']);
      const link = getCell(r, ['Link', 'link', 'URL', 'url', 'Affiliate Link', 'affiliate_link']);
      const norm = normalize(product_name);

      if (!product_name) {
        return { product_name, link, product_name_normalized: norm, status: 'invalid', error: 'Missing Product name' };
      }
      if (!link) {
        return { product_name, link, product_name_normalized: norm, status: 'invalid', error: 'Missing Link' };
      }
      if (!norm) {
        return { product_name, link, product_name_normalized: norm, status: 'invalid', error: 'Product name must contain alphanumeric characters' };
      }
      if (seen.has(norm)) {
        return { product_name, link, product_name_normalized: norm, status: 'duplicate-in-file' };
      }
      seen.add(norm);
      return { product_name, link, product_name_normalized: norm, status: 'valid' };
    });
    setRows(parsed);
    setResult(null);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => processRows(res.data as any[]),
          error: (err) => toast.error(`CSV parse error: ${err.message}`),
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        processRows(json);
      } else {
        toast.error('Unsupported file type. Use CSV or Excel.');
      }
    } catch (e: any) {
      toast.error(`Failed to read file: ${e.message}`);
    }
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r.status === 'valid');
    if (valid.length === 0) { toast.error('No valid rows to import'); return; }
    setImporting(true);
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('affiliate_products')
        .select('product_name_normalized');
      if (fetchErr) throw fetchErr;

      const existingSet = new Set((existing || []).map((e: any) => e.product_name_normalized));
      const toInsert = valid.filter((r) => !existingSet.has(r.product_name_normalized));
      const skipped = valid.length - toInsert.length;

      if (toInsert.length === 0) {
        setResult({ inserted: 0, skipped });
        toast.info(`All ${skipped} rows already exist. Nothing inserted.`);
        return;
      }

      const payload = toInsert.map((r) => ({
        product_name: r.product_name,
        link: r.link,
        product_name_normalized: r.product_name_normalized,
      }));

      let inserted = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase.from('affiliate_products').insert(payload.slice(i, i + 500));
        if (error) throw error;
        inserted += Math.min(500, payload.length - i);
      }

      setResult({ inserted, skipped });
      toast.success(`Inserted ${inserted} products. Skipped ${skipped} duplicates.`);
      await loadProducts();
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setEditName(p.product_name);
    setEditLink(p.link);
  };

  const openAdd = () => {
    setEditing(null);
    setEditName('');
    setEditLink('');
    setAddOpen(true);
  };

  const handleSave = async () => {
    const name = editName.trim();
    const link = editLink.trim();
    if (!name || !link) { toast.error('Product name and link are required'); return; }
    const norm = normalize(name);
    if (!norm) { toast.error('Product name must contain alphanumeric characters'); return; }
    setSaving(true);
    try {
      const { data: dup, error: dupErr } = await supabase
        .from('affiliate_products')
        .select('id')
        .eq('product_name_normalized', norm)
        .maybeSingle();
      if (dupErr && dupErr.code !== 'PGRST116') throw dupErr;
      if (dup && (!editing || dup.id !== editing.id)) {
        toast.error('Another product with the same normalized name already exists');
        setSaving(false);
        return;
      }

      if (editing) {
        const { error } = await supabase
          .from('affiliate_products')
          .update({ product_name: name, link, product_name_normalized: norm })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Product updated');
      } else {
        const { error } = await supabase
          .from('affiliate_products')
          .insert({ product_name: name, link, product_name_normalized: norm });
        if (error) throw error;
        toast.success('Product added');
      }
      setEditing(null);
      setAddOpen(false);
      await loadProducts();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('affiliate_products').delete().eq('id', deletingId);
      if (error) throw error;
      toast.success('Product deleted');
      setDeletingId(null);
      await loadProducts();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const dupCount = rows.filter((r) => r.status === 'duplicate-in-file').length;

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [p.product_name, p.link, p.product_name_normalized].some((v) => (v || '').toLowerCase().includes(q));
  });

  const dialogOpen = !!editing || addOpen;

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Affiliate Products</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Link className="h-6 w-6" /> Affiliate Products Manager
      </h1>

      <Card className="p-6 mb-6 shadow-card">
        <h2 className="text-lg font-semibold mb-3">Bulk Import</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Upload CSV or Excel file</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Required columns: <code>Product name</code>, <code>Link</code>. The <code>product_name_normalized</code> field is generated automatically.
            </p>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
          {fileName && <p className="text-sm text-muted-foreground">Loaded: <strong>{fileName}</strong></p>}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-6 mb-6 shadow-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default">{validCount} valid</Badge>
              {dupCount > 0 && <Badge variant="secondary">{dupCount} duplicate in file</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
            </div>
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Importing...' : `Import ${validCount} rows`}
            </Button>
          </div>

          {result && (
            <div className="mb-4 p-3 rounded bg-muted text-sm">
              ✅ Inserted: <strong>{result.inserted}</strong> · Skipped (already in DB): <strong>{result.skipped}</strong>
            </div>
          )}

          <div className="max-h-[400px] overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Normalized</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.product_name || <em className="text-muted-foreground">empty</em>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.product_name_normalized}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.link || '-'}</TableCell>
                    <TableCell>
                      {r.status === 'valid' && <Badge variant="default">Valid</Badge>}
                      {r.status === 'duplicate-in-file' && <Badge variant="secondary">Dup in file</Badge>}
                      {r.status === 'invalid' && <Badge variant="destructive" title={r.error}>Invalid</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">Existing Products</h2>
            <p className="text-sm text-muted-foreground">
              {loadingProducts ? 'Loading...' : `${products.length} total`}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-8 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Add Product
            </Button>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Normalized</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {loadingProducts ? 'Loading...' : 'No products found'}
                  </TableCell>
                </TableRow>
              )}
              {filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.product_name_normalized}</TableCell>
                  <TableCell>
                    <a href={p.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary underline flex items-center gap-1 max-w-xs truncate">
                      {p.link} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(p.id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setEditing(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product_name">Product Name</Label>
              <Input
                id="product_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Chia Seeds"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Normalized: <code>{normalize(editName) || '—'}</code>
              </p>
            </div>
            <div>
              <Label htmlFor="link">Affiliate Link</Label>
              <Input
                id="link"
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="outline" onClick={() => { setEditing(null); setAddOpen(false); }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the affiliate product link from the master list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AffiliateProductsImport;
