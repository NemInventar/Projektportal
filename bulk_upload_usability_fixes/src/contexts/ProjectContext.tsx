import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  name: string;
  customer?: string;
  projectNumber?: string;
  phase: 'Tilbud' | 'Produktion' | 'Tabt' | 'Arkiv' | 'Garanti';
  isStarred?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectContextType {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  loading: boolean;
  isUsingMockData: boolean;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  toggleStar: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

// Mock data for demonstration
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Køkkenrenovering Villa Skovvej',
    customer: 'Familie Hansen',
    projectNumber: 'P2024-001',
    phase: 'Produktion',
    isStarred: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: '2',
    name: 'Kontorindretning TechCorp',
    customer: 'TechCorp A/S',
    projectNumber: 'P2024-002',
    phase: 'Tilbud',
    isStarred: false,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: '3',
    name: 'Badeværelse Østerbro',
    customer: 'Andersen & Co',
    projectNumber: 'P2024-003',
    phase: 'Garanti',
    isStarred: false,
    createdAt: new Date('2023-12-05'),
    updatedAt: new Date('2024-01-12'),
  },
  {
    id: '4',
    name: 'Showroom Nørrebro',
    customer: 'Design Studio',
    projectNumber: 'P2024-004',
    phase: 'Arkiv',
    isStarred: false,
    createdAt: new Date('2023-11-20'),
    updatedAt: new Date('2023-12-15'),
  },
];

// Helper functions for localStorage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      const parsed = JSON.parse(item);
      // Convert date strings back to Date objects for projects
      if (Array.isArray(parsed) && key.includes('projects')) {
        return parsed.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        })) as T;
      }
      return parsed;
    }
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
};

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [loading, setLoading] = useState(true);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  // Load projects from Supabase on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      console.log('Loading projects from Supabase...');
      const { data, error } = await supabase
        .from('projects_2026_01_15_06_45')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error loading projects:', error);
        // Fallback to mock data if Supabase fails
        console.log('Using mock data as fallback');
        setProjects(mockProjects);
        setIsUsingMockData(true);
        // Set a default active project for testing
        // Set Køkkenrenovering Villa Skovvej as default for development
        const defaultProject = mockProjects.find(p => p.name.includes('Køkkenrenovering Villa Skovvej')) || mockProjects[0];
        if (defaultProject && !activeProject) {
          setActiveProject(defaultProject);
        }
      } else {
        console.log('Successfully loaded projects:', data?.length || 0);
        const formattedProjects = data.map(p => ({
          id: p.id,
          name: p.name,
          customer: p.customer,
          projectNumber: p.project_number,
          phase: p.phase,
          isStarred: p.is_starred || false,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at)
        }));
        setProjects(formattedProjects);
        
        // Always prioritize starred project as active
        const starredProject = formattedProjects.find(p => p.isStarred);
        if (starredProject) {
          // If there's a starred project, always set it as active
          setActiveProject(starredProject);
        } else if (!activeProject) {
          // Only set fallback if no active project exists
          const defaultProject = formattedProjects.find(p => p.name.includes('Køkkenrenovering Villa Skovvej')) || 
            formattedProjects[0];
          if (defaultProject) {
            setActiveProject(defaultProject);
          }
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects(mockProjects);
      // Always prioritize starred project as active
      const starredProject = mockProjects.find(p => p.isStarred);
      if (starredProject) {
        // If there's a starred project, always set it as active
        setActiveProject(starredProject);
      } else if (!activeProject) {
        // Only set fallback if no active project exists
        const defaultProject = mockProjects.find(p => p.name.includes('Køkkenrenovering Villa Skovvej')) || 
          mockProjects[0];
        if (defaultProject) {
          setActiveProject(defaultProject);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const addProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('Adding project to Supabase:', projectData);
      const { data, error } = await supabase
        .from('projects_2026_01_15_06_45')
        .insert({
          name: projectData.name,
          customer: projectData.customer,
          project_number: projectData.projectNumber,
          phase: projectData.phase
        })
        .select()
        .single();

      console.log('Supabase insert response:', { data, error });

      if (error) {
        console.error('Error adding project:', error);
        throw error;
      }

      const newProject: Project = {
        id: data.id,
        name: data.name,
        customer: data.customer,
        projectNumber: data.project_number,
        phase: data.phase,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      setProjects(prev => [newProject, ...prev]);
    } catch (error) {
      console.error('Error adding project:', error);
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      console.log('Updating project in Supabase:', id, updates);
      
      // Update in Supabase
      const { error } = await supabase
        .from('projects_2026_01_15_06_45')
        .update({
          name: updates.name,
          customer: updates.customer,
          project_number: updates.projectNumber,
          phase: updates.phase,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Error updating project in Supabase:', error);
        throw error;
      }

      console.log('Project updated successfully in Supabase');
    } catch (error) {
      console.error('Failed to update project in Supabase, updating locally only:', error);
    }
    
    // Update local state regardless of Supabase success/failure
    const updatedProjects = projects.map(project => 
      project.id === id 
        ? { ...project, ...updates, updatedAt: new Date() }
        : project
    );
    setProjects(updatedProjects);
    saveToStorage('nem_inventar_projects', updatedProjects);
    
    // Update active project if it's the one being updated
    if (activeProject?.id === id) {
      const updatedActiveProject = { ...activeProject, ...updates, updatedAt: new Date() };
      setActiveProject(updatedActiveProject);
      saveToStorage('nem_inventar_active_project', updatedActiveProject);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      console.log('Deleting project from Supabase:', id);
      
      // Delete from Supabase
      const { error } = await supabase
        .from('projects_2026_01_15_06_45')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting project from Supabase:', error);
        throw error;
      }

      console.log('Project deleted successfully from Supabase');
    } catch (error) {
      console.error('Failed to delete project from Supabase, deleting locally only:', error);
    }
    
    // Update local state regardless of Supabase success/failure
    const updatedProjects = projects.filter(project => project.id !== id);
    setProjects(updatedProjects);
    saveToStorage('nem_inventar_projects', updatedProjects);
    
    // Clear active project if it's the one being deleted
    if (activeProject?.id === id) {
      setActiveProject(null);
      saveToStorage('nem_inventar_active_project', null);
    }
  };

  const toggleStar = async (id: string) => {
    try {
      const project = projects.find(p => p.id === id);
      if (!project) return;
      
      // If project is already starred, do nothing (no unstar in V1)
      if (project.isStarred) return;
      
      // Update all projects: unstar all except the selected one, star the selected one
      // First get all project IDs
      const allProjectIds = projects.map(p => p.id);
      
      // Update all other projects to unstarred
      const otherProjectIds = allProjectIds.filter(pid => pid !== id);
      if (otherProjectIds.length > 0) {
        const { error: unstarError } = await supabase
          .from('projects_2026_01_15_06_45')
          .update({ 
            is_starred: false,
            updated_at: new Date().toISOString()
          })
          .in('id', otherProjectIds);

        if (unstarError) {
          console.error('Error unstarring other projects:', unstarError);
          throw unstarError;
        }
      }
      
      // Then star the selected project
      const { error: starError } = await supabase
        .from('projects_2026_01_15_06_45')
        .update({ 
          is_starred: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (starError) {
        console.error('Error starring project:', starError);
        throw starError;
      }

      // Update local state - unstar all, then star the selected one
      const updatedProjects = projects.map(p => ({
        ...p,
        isStarred: p.id === id,
        updatedAt: new Date()
      }));
      
      setProjects(updatedProjects);
      saveToStorage('nem_inventar_projects', updatedProjects);
      
      // Set the starred project as active project
      const newActiveProject = updatedProjects.find(p => p.id === id);
      if (newActiveProject) {
        setActiveProject(newActiveProject);
        saveToStorage('nem_inventar_active_project', newActiveProject);
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleSetActiveProject = (project: Project | null) => {
    setActiveProject(project);
    saveToStorage('nem_inventar_active_project', project);
  };

  return (
    <ProjectContext.Provider value={{
      activeProject,
      setActiveProject: handleSetActiveProject,
      projects,
      setProjects,
      loading,
      isUsingMockData,
      addProject,
      updateProject,
      deleteProject,
      toggleStar,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};