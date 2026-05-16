import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useLeads } from '@/features/leads';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  FolderOpen,
  BarChart3,
  Package,
  Wrench,
  Users,
  FileText,
  ClipboardList,
  Settings,
  Inbox,
  Building2,
  Contact,
  Layers
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const { activeProject } = useProject();
  const { overdueCount } = useLeads();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const mainMenuItems: Array<{
    label: string;
    icon: any;
    path: string;
    active: boolean;
    badge?: number;
  }> = [
    {
      label: 'Leads',
      icon: Inbox,
      path: '/leads',
      active: isActive('/leads') || location.pathname.startsWith('/leads/'),
      badge: overdueCount > 0 ? overdueCount : undefined,
    },
    {
      label: 'Projekter',
      icon: FolderOpen,
      path: '/',
      active: isActive('/')
    },
    {
      label: 'Portefølje',
      icon: Layers,
      path: '/portfolio/materials',
      active: isActive('/portfolio/materials')
    },
    {
      label: 'Firmaer',
      icon: Building2,
      path: '/firmaer',
      active: isActive('/firmaer') || location.pathname.startsWith('/firmaer/'),
    },
    {
      label: 'Kontakter',
      icon: Contact,
      path: '/kontakter',
      active: isActive('/kontakter') || location.pathname.startsWith('/kontakter/'),
    },
    {
      label: 'Medarbejdere',
      icon: Users,
      path: '/medarbejdere',
      active: isActive('/medarbejdere') || location.pathname.startsWith('/medarbejdere/'),
    },
  ];

  // Indstillinger ligger i sidebar-footer (se nederst i return).

  const standardMenuItems = [
    { 
      label: 'Standard Leverandører', 
      icon: Users, 
      path: '/standard/suppliers',
      active: isActive('/standard/suppliers')
    },
    { 
      label: 'Standard Materialer', 
      icon: Package, 
      path: '/standard/materials',
      active: isActive('/standard/materials') || location.pathname.startsWith('/standard/materials/')
    },
  ];

  // Aktive projekt-menu items (færdige features).
  // Skjulte indtil de er bygget ordentligt: Indkøb, Budgetter, Budget, BOM, Purchase Orders, Prisindhentning, Leverandører.
  // Routes findes stadig — kan tilgås via direkte URL — og kan re-enables her når de er klar.
  const projectMenuItems = activeProject ? [
    {
      label: 'Overblik',
      icon: BarChart3,
      path: '/project/overview',
      active: isActive('/project/overview')
    },
    {
      label: 'Materialer',
      icon: Wrench,
      path: '/project/materials',
      active: isActive('/project/materials')
    },
    {
      label: 'Produkter',
      icon: Package,
      path: '/project/products',
      active: isActive('/project/products')
    },
    {
      label: 'Tilbud',
      icon: FileText,
      path: '/project/quotes',
      active: isActive('/project/quotes')
    },
    {
      label: 'BOM',
      icon: ClipboardList,
      path: '/project/bom',
      active: isActive('/project/bom')
    },
  ] : [];

  return (
    <div className="w-64 bg-card border-r border-border h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-foreground">NemInventar</h1>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {mainMenuItems.map((item) => (
            <Button
              key={item.path}
              variant={item.active ? "default" : "ghost"}
              className={cn(
                "w-full justify-start gap-3",
                item.active && "bg-primary text-primary-foreground"
              )}
              onClick={() => navigate(item.path)}
              title={item.badge ? `${item.badge} forfaldne aktiviteter` : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-5 px-1.5 text-xs bg-red-100 text-red-800 border-red-200"
                >
                  {item.badge}
                </Badge>
              ) : null}
            </Button>
          ))}
        </div>

        {/* Standard Section */}
        <Separator className="mx-4" />
        <div className="p-4">
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Standard
            </p>
          </div>
          
          <div className="space-y-1">
            {standardMenuItems.map((item) => (
              <Button
                key={item.path}
                variant={item.active ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "w-full justify-start gap-3",
                  item.active && "bg-primary text-primary-foreground"
                )}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Project Section */}
        {activeProject && (
          <>
            <Separator className="mx-4" />
            <div className="p-4">
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Aktivt Projekt
                </p>
                <p className="text-sm font-medium text-foreground mt-1 truncate">
                  {activeProject.name}
                </p>
              </div>
              
              <div className="space-y-1">
                {projectMenuItems.map((item) => (
                  <Button
                    key={item.path}
                    variant={item.active ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start gap-3",
                      item.active && "bg-primary text-primary-foreground"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer — Indstillinger holdes nederst, væk fra det daglige arbejde */}
      <div className="p-4 border-t border-border">
        <Button
          variant={isActive('/indstillinger') ? 'default' : 'ghost'}
          size="sm"
          className={cn(
            'w-full justify-start gap-3',
            isActive('/indstillinger') && 'bg-primary text-primary-foreground'
          )}
          onClick={() => navigate('/indstillinger')}
        >
          <Settings className="h-4 w-4" />
          Indstillinger
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;