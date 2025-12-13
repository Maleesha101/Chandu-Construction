import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Site } from '@/lib/types';
import { toast } from 'sonner';
import { Plus, Building2, Loader2, MapPin, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export default function Sites() {
  const { isRole } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    code: '',
  });

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const { data } = await supabase
        .from('sites')
        .select('*')
        .order('name');

      if (data) {
        setSites(data as Site[]);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
      toast.error('Failed to load sites');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Site name is required');
      return;
    }
    setSubmitting(true);

    try {
      const { error } = await supabase.from('sites').insert({
        name: formData.name.trim(),
        location: formData.location.trim() || null,
        code: formData.code.trim().toUpperCase() || null,
      });

      if (error) throw error;

      toast.success('Site created successfully');
      setDialogOpen(false);
      setFormData({ name: '', location: '', code: '' });
      fetchSites();
    } catch (error: any) {
      console.error('Error creating site:', error);
      if (error.code === '23505') {
        toast.error('A site with this code already exists');
      } else {
        toast.error('Failed to create site');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (site: Site) => {
    try {
      const { error } = await supabase
        .from('sites')
        .update({ active: !site.active })
        .eq('id', site.id);

      if (error) throw error;

      toast.success(`Site ${site.active ? 'deactivated' : 'activated'}`);
      fetchSites();
    } catch (error) {
      console.error('Error updating site:', error);
      toast.error('Failed to update site');
    }
  };

  return (
    <DashboardLayout title="Construction Sites" description="Manage your construction site locations">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Building2 className="h-3 w-3" />
            {sites.filter((s) => s.active).length} Active Sites
          </Badge>
        </div>
        {isRole(['boss', 'admin']) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Site</DialogTitle>
                <DialogDescription>
                  Create a new construction site for expense tracking.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Site Name *</Label>
                  <Input
                    placeholder="e.g., Colombo Tower Project"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input
                    placeholder="e.g., Colombo 03"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Site Code</Label>
                  <Input
                    placeholder="e.g., COL01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional short code for quick reference
                  </p>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Site
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Sites Table */}
      <div className="stat-card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          </div>
        ) : sites.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No sites yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first construction site to start tracking expenses.
            </p>
            {isRole(['boss', 'admin']) && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Site Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id} className="data-table-row">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {site.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {site.code ? (
                      <Badge variant="secondary">{site.code}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {site.location ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {site.location}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={site.active ? 'default' : 'secondary'}
                      className={site.active ? 'bg-emerald-100 text-emerald-800' : ''}
                    >
                      {site.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(site.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    {isRole(['boss', 'admin']) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(site)}
                      >
                        {site.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
}
