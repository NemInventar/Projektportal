import React from 'react';
import Layout from '@/components/Layout';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Calendar, 
  DollarSign, 
  Package, 
  Users, 
  FileText,
  TrendingUp,
  Clock
} from 'lucide-react';

const ProjectOverview = () => {
  const { activeProject } = useProject();

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Intet projekt valgt</h2>
            <p className="text-muted-foreground mb-4">
              Vælg et projekt fra projektlisten for at se overblikket
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Gå til Projekter
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Tilbud': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Produktion': return 'bg-green-100 text-green-800 border-green-200';
      case 'Tabt': return 'bg-red-100 text-red-800 border-red-200';
      case 'Arkiv': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Garanti': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{activeProject.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-muted-foreground">
                {activeProject.customer && `${activeProject.customer} • `}
                {activeProject.projectNumber}
              </p>
              <Badge className={getPhaseColor(activeProject.phase)}>
                {activeProject.phase}
              </Badge>
            </div>
          </div>
          
          <div className="text-right text-sm text-muted-foreground">
            <p>Oprettet: {activeProject.createdAt.toLocaleDateString('da-DK')}</p>
            <p>Opdateret: {activeProject.updatedAt.toLocaleDateString('da-DK')}</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Samlet Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0 kr</div>
              <p className="text-xs text-muted-foreground">
                Ingen budget defineret endnu
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produkter</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Ingen produkter tilføjet
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Leverandører</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Ingen leverandører registreret
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tilbud</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Ingen tilbud oprettet
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Hurtige Handlinger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex flex-col gap-2">
                <Package className="h-6 w-6" />
                <span>Tilføj Produkter</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex flex-col gap-2">
                <Users className="h-6 w-6" />
                <span>Administrer Leverandører</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex flex-col gap-2">
                <FileText className="h-6 w-6" />
                <span>Opret Tilbud</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex flex-col gap-2">
                <DollarSign className="h-6 w-6" />
                <span>Definer Budget</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex flex-col gap-2">
                <BarChart3 className="h-6 w-6" />
                <span>Generer BOM</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex flex-col gap-2">
                <Clock className="h-6 w-6" />
                <span>Projekthistorik</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Seneste Aktivitet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Projekt oprettet</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProject.createdAt.toLocaleDateString('da-DK')} kl. {activeProject.createdAt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              <div className="text-center py-8 text-muted-foreground">
                <p>Ingen yderligere aktivitet endnu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ProjectOverview;