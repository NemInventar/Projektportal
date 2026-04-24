import React from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useQuoteReview } from '@/features/purchasing';
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
  Calculator,
  PieChart,
  ClipboardList,
  ShoppingCart,
  Settings,
  Database,
  DollarSign,
  Inbox
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const { activeProject } = useProject();
  const { count: reviewCount } = useQuoteReview();
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
  ];

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
      label: 'Indkøb',
      icon: ShoppingCart,
      path: '/purchasing',
      active: isActive('/purchasing') || location.pathname.startsWith('/purchasing/'),
      badge: reviewCount > 0 ? reviewCount : undefined,
    },
    { 
      label: 'Budgetter', 
      icon: PieChart, 
      path: '/project/budgets',
      active: isActive('/project/budgets')
    },
    { 
      label: 'Budget', 
      icon: Calculator, 
      path: '/project/budget',
      active: isActive('/project/budget')
    },
    { 
      label: 'BOM', 
      icon: ClipboardList, 
      path: '/project/bom',
      active: isActive('/project/bom')
    },
    { 
      label: 'Purchase Orders', 
      icon: ShoppingCart, 
      path: '/project/purchase-orders',
      active: isActive('/project/purchase-orders')
    },
    { 
      label: 'Prisindhentning', 
      icon: DollarSign, 
      path: '/project/price-requests',
      active: isActive('/project/price-requests')
    },
    { 
      label: 'Leverandører', 
      icon: Users, 
      path: '/project/suppliers',
      active: isActive('/project/suppliers')
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
                    title={item.badge ? `${item.badge} svar venter på gennemsyn` : undefined}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge ? (
                      <Badge
                        variant="secondary"
                        className="h-5 min-w-5 px-1.5 text-xs bg-amber-100 text-amber-800 border-amber-200"
                      >
                        {item.badge}
                      </Badge>
                    ) : null}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3"
          onClick={() => navigate('/settings')}
        >
          <Settings className="h-4 w-4" />
          Indstillinger
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;