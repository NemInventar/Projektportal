import React, { useState } from 'react';
import { useProject, Project } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit, Trash2, Star, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ProjectForm: React.FC<{
  project?: Project;
  onSubmit: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}> = ({ project, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    customer: project?.customer || '',
    projectNumber: project?.projectNumber || '',
    phase: project?.phase || 'Tilbud' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    onSubmit(formData);
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Projektnavn *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Indtast projektnavn"
          required
        />
      </div>
      
      <div>
        <Label htmlFor="customer">Kunde</Label>
        <Input
          id="customer"
          value={formData.customer}
          onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
          placeholder="Indtast kundenavn"
        />
      </div>
      
      <div>
        <Label htmlFor="projectNumber">Projekt nr.</Label>
        <Input
          id="projectNumber"
          value={formData.projectNumber}
          onChange={(e) => setFormData(prev => ({ ...prev, projectNumber: e.target.value }))}
          placeholder="Indtast projektnummer"
        />
      </div>
      
      <div>
        <Label htmlFor="phase">Fase</Label>
        <Select 
          value={formData.phase} 
          onValueChange={(value: Project['phase']) => setFormData(prev => ({ ...prev, phase: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Tilbud">Tilbud</SelectItem>
            <SelectItem value="Produktion">Produktion</SelectItem>
            <SelectItem value="Garanti">Garanti</SelectItem>
            <SelectItem value="Tabt">Tabt</SelectItem>
            <SelectItem value="Arkiv">Arkiv</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {project ? 'Opdater' : 'Opret'} Projekt
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuller
        </Button>
      </div>
    </form>
  );
};

const ProjectList = () => {
  const { 
    projects, 
    activeProject, 
    setActiveProject, 
    addProject, 
    updateProject, 
    deleteProject,
    toggleStar,
    loading,
    isUsingMockData 
  } = useProject();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  // Collapsible sections state with localStorage persistence
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('nem_inventar_expanded_project_sections');
      return saved ? JSON.parse(saved) : {
        'Tilbud': true,
        'Produktion': true,
        'Garanti': true,
        'Tabt': true,
        'Arkiv': true
      };
    } catch {
      return {
        'Tilbud': true,
        'Produktion': true,
        'Garanti': true,
        'Tabt': true,
        'Arkiv': true
      };
    }
  });
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newState = {
        ...prev,
        [section]: !prev[section]
      };
      localStorage.setItem('nem_inventar_expanded_project_sections', JSON.stringify(newState));
      return newState;
    });
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.projectNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPhase = phaseFilter === 'all' || project.phase === phaseFilter;
    
    return matchesSearch && matchesPhase;
  });
  
  // Group projects by phase in specific order
  const phaseOrder = ['Tilbud', 'Produktion', 'Garanti', 'Tabt', 'Arkiv'];
  const groupedProjects = phaseOrder.reduce((acc, phase) => {
    acc[phase] = filteredProjects.filter(project => project.phase === phase);
    return acc;
  }, {} as Record<string, Project[]>);
  
  const phaseLabels = {
    'Tilbud': 'Tilbud',
    'Produktion': 'Produktion', 
    'Garanti': 'Garanti',
    'Tabt': 'Tabt',
    'Arkiv': 'Arkiv'
  };
  
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Tilbud': return 'text-blue-700';
      case 'Produktion': return 'text-green-700';
      case 'Garanti': return 'text-purple-700';
      case 'Tabt': return 'text-red-700';
      case 'Arkiv': return 'text-gray-700';
      default: return 'text-gray-700';
    }
  };
  
  // Render table for a specific phase
  const renderProjectTable = (phaseProjects: Project[], phase: string) => {
    if (phaseProjects.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Ingen projekter i denne fase
        </div>
      );
    }
    
    // Sort projects: starred first, then by updated date (newest first), then by project number
    const sortedProjects = [...phaseProjects].sort((a, b) => {
      // First priority: starred projects
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      
      // Second priority: updated date (newest first)
      const dateA = new Date(a.updatedAt).getTime();
      const dateB = new Date(b.updatedAt).getTime();
      if (dateA !== dateB) return dateB - dateA;
      
      // Third priority: project number (ascending)
      const numA = a.projectNumber || '';
      const numB = b.projectNumber || '';
      return numA.localeCompare(numB);
    });
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">★</TableHead>
            <TableHead>Projektnavn</TableHead>
            <TableHead>Kunde</TableHead>
            <TableHead>Projekt nr.</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead>Opdateret</TableHead>
            <TableHead className="w-24">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProjects.map((project) => (
            <TableRow 
              key={project.id}
              className={`cursor-pointer hover:bg-muted/50 ${
                activeProject?.id === project.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
              }`}
              onClick={() => handleProjectSelect(project)}
            >
              <TableCell className="w-12">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStar(project.id);
                  }}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <Star 
                    className={`h-4 w-4 ${
                      project.isStarred 
                        ? 'fill-yellow-400 text-yellow-400' 
                        : 'text-muted-foreground hover:text-yellow-400'
                    }`}
                  />
                </button>
              </TableCell>
              <TableCell className="font-medium">
                {project.name}
              </TableCell>
              <TableCell>{project.customer || '-'}</TableCell>
              <TableCell>{project.projectNumber || '-'}</TableCell>
              <TableCell>
                <Badge className={getPhaseBadgeColor(project.phase)}>
                  {project.phase}
                </Badge>
              </TableCell>
              <TableCell>{project.updatedAt.toLocaleDateString('da-DK')}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProject(project);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const handleProjectSelect = (project: Project) => {
    setActiveProject(project);
    toast({
      title: "Projekt valgt",
      description: `${project.name} er nu det aktive projekt`,
    });
  };

  const handleCreateProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addProject(projectData);
      toast({
        title: "Projekt oprettet",
        description: `${projectData.name} er blevet oprettet`,
      });
    } catch (error) {
      toast({
        title: "Fejl ved oprettelse",
        description: "Projektet kunne ikke oprettes",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProject) {
      try {
        await updateProject(editingProject.id, projectData);
        toast({
          title: "Projekt opdateret",
          description: `${projectData.name} er blevet opdateret`,
        });
        setEditingProject(null);
      } catch (error) {
        toast({
          title: "Fejl ved opdatering",
          description: "Projektet kunne ikke opdateres i databasen",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (confirm(`Er du sikker på, at du vil slette projektet "${project.name}"?`)) {
      try {
        await deleteProject(project.id);
        toast({
          title: "Projekt slettet",
          description: `${project.name} er blevet slettet`,
        });
      } catch (error) {
        toast({
          title: "Fejl ved sletning",
          description: "Projektet kunne ikke slettes",
          variant: "destructive",
        });
      }
    }
  };

  const getPhaseBadgeColor = (phase: Project['phase']) => {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projekter</h1>
          <p className="text-muted-foreground mt-1">
            Administrer dine projekter og vælg et aktivt projekt at arbejde i
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nyt Projekt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Opret Nyt Projekt</DialogTitle>
            </DialogHeader>
            <ProjectForm
              onSubmit={handleCreateProject}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Mock Data Warning */}
      {isUsingMockData && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div>
                <p className="font-medium text-yellow-800">Advarsel: Data gemmes kun lokalt</p>
                <p className="text-sm text-yellow-700">
                  Forbindelsen til databasen fejlede. Dine ændringer gemmes kun lokalt og vil gå tabt når du lukker browseren.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Project Info */}
      {activeProject && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full"></div>
              Aktivt Projekt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{activeProject.name}</p>
                <p className="text-sm text-muted-foreground">
                  {activeProject.customer && `${activeProject.customer} • `}
                  {activeProject.projectNumber}
                </p>
              </div>
              <Badge className={getPhaseBadgeColor(activeProject.phase)}>
                {activeProject.phase}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg i projekter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrer på fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle faser</SelectItem>
                <SelectItem value="Tilbud">Tilbud</SelectItem>
                <SelectItem value="Produktion">Produktion</SelectItem>
                <SelectItem value="Tabt">Tabt</SelectItem>
                <SelectItem value="Arkiv">Arkiv</SelectItem>
                <SelectItem value="Garanti">Garanti</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Project Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Indlæser projekter...</p>
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="space-y-8 p-6">
              {phaseOrder.map((phase) => {
                const phaseProjects = groupedProjects[phase];
                if (phaseProjects.length === 0) return null;
                
                return (
                  <div key={phase}>
                    <div 
                      className="flex justify-between items-center mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded"
                      onClick={() => toggleSection(phase)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown 
                          className={`h-4 w-4 transition-transform ${
                            expandedSections[phase] ? 'rotate-0' : '-rotate-90'
                          }`}
                        />
                        <h3 className={`text-lg font-semibold ${getPhaseColor(phase)}`}>{phaseLabels[phase]}</h3>
                      </div>
                      <div className="text-base text-gray-600">
                        <span>Antal: {phaseProjects.length}</span>
                      </div>
                    </div>
                    {expandedSections[phase] && renderProjectTable(phaseProjects, phase)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchTerm || phaseFilter !== 'all' 
                  ? 'Ingen projekter matcher dine filtre' 
                  : 'Ingen projekter endnu'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingProject} onOpenChange={() => setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger Projekt</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <ProjectForm
              project={editingProject}
              onSubmit={handleUpdateProject}
              onCancel={() => setEditingProject(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectList;