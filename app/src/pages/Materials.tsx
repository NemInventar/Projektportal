import React from 'react';
import Layout from '@/components/Layout';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Plus } from 'lucide-react';

const Materials = () => {
  const { activeProject } = useProject();

  if (!activeProject) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Intet projekt valgt</h2>
            <p className="text-muted-foreground mb-4">
              Vælg et projekt fra projektlisten for at administrere materialer
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Gå til Projekter
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Materialer</h1>
            <p className="text-muted-foreground mt-1">
              Administrer materialer for {activeProject.name}
            </p>
          </div>
          
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Tilføj Materiale
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wrench className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Ingen materialer endnu</h3>
            <p className="text-muted-foreground text-center mb-6">
              Tilføj materialer til dit projekt for at holde styr på dit lager
            </p>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Tilføj Dit Første Materiale
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Materials;