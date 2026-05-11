import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Home, ChevronRight, Ruler } from 'lucide-react';
import { useActiveClients } from '@/hooks/useClients';
import { ClientMeasurementsPanel } from '@/components/clients/ClientMeasurementsPanel';

const Measurements = () => {
  const { data: clients = [], isLoading } = useActiveClients();
  const [selectedClientId, setSelectedClientId] = useState('');
  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Body Measurements</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Ruler className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Body Measurements</h1>
      </div>

      <Card className="p-6 mb-6 shadow-card">
        <div className="max-w-sm space-y-2">
          <Label>Select Client</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? 'Loading...' : 'Choose a client'} />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {selectedClient && (
        <Card className="p-6 shadow-card">
          <ClientMeasurementsPanel clientId={selectedClient.id} clientName={selectedClient.name} />
        </Card>
      )}
    </DashboardLayout>
  );
};

export default Measurements;
