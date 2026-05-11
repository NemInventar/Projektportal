import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interne medarbejdere — adskilt fra companies (eksterne firmaer) og crm_contacts (eksterne personer).
// Skema-arkitektur: employees lever i sin egen tabel uden FK til companies.

export interface Employee {
  id: string;
  // Basale felter
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  initials?: string | null;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  department?: string | null;
  active: boolean;
  startDate?: string | null;
  endDate?: string | null;
  photoUrl?: string | null;
  bio?: string | null;
  notes?: string | null;
  // Adresse
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  // HR-felter (sensitive)
  cpr?: string | null;
  taxCardType?: string | null;
  employmentType?: string | null;
  salaryDkkMonthly?: number | null;
  hourlyRateDkk?: number | null;
  birthday?: string | null;
  primaryVehicleRegistration?: string | null;
  // System
  authUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type EmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

interface EmployeesContextType {
  employees: Employee[];
  loading: boolean;
  reload: () => Promise<void>;
  addEmployee: (input: EmployeeInput) => Promise<Employee>;
  updateEmployee: (id: string, updates: Partial<EmployeeInput>) => Promise<void>;
  removeEmployee: (id: string) => Promise<void>;
  countQuotesUsing: (id: string) => Promise<number>;
}

const EmployeesContext = createContext<EmployeesContextType | undefined>(undefined);

const TABLE = 'employees';

const rowToEmployee = (r: any): Employee => ({
  id: r.id,
  fullName: r.full_name ?? '',
  firstName: r.first_name ?? null,
  lastName: r.last_name ?? null,
  initials: r.initials ?? null,
  nickname: r.nickname ?? null,
  email: r.email ?? null,
  phone: r.phone ?? null,
  role: r.role ?? null,
  department: r.department ?? null,
  active: r.active ?? true,
  startDate: r.start_date ?? null,
  endDate: r.end_date ?? null,
  photoUrl: r.photo_url ?? null,
  bio: r.bio ?? null,
  notes: r.notes ?? null,
  address: r.address ?? null,
  postalCode: r.postal_code ?? null,
  city: r.city ?? null,
  country: r.country ?? null,
  cpr: r.cpr ?? null,
  taxCardType: r.tax_card_type ?? null,
  employmentType: r.employment_type ?? null,
  salaryDkkMonthly: r.salary_dkk_monthly != null ? Number(r.salary_dkk_monthly) : null,
  hourlyRateDkk: r.hourly_rate_dkk != null ? Number(r.hourly_rate_dkk) : null,
  birthday: r.birthday ?? null,
  primaryVehicleRegistration: r.primary_vehicle_registration ?? null,
  authUserId: r.auth_user_id ?? null,
  createdAt: r.created_at ? new Date(r.created_at) : new Date(),
  updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
});

// Patch-builder — kun felter der eksplicit er med i input bliver mappet til DB,
// så partial updates ikke nuller eksisterende værdier.
// BEMÆRK: full_name er en GENERATED kolonne (first_name || ' ' || last_name) i DB
// og kan derfor ikke skrives direkte — den udelades med vilje.
const inputToRow = (input: Partial<EmployeeInput>): Record<string, any> => {
  const out: Record<string, any> = {};
  if ('firstName' in input) out.first_name = input.firstName ?? null;
  if ('lastName' in input) out.last_name = input.lastName ?? null;
  if ('initials' in input) out.initials = input.initials ?? null;
  if ('nickname' in input) out.nickname = input.nickname ?? null;
  if ('email' in input) out.email = input.email ?? null;
  if ('phone' in input) out.phone = input.phone ?? null;
  if ('role' in input) out.role = input.role ?? null;
  if ('department' in input) out.department = input.department ?? null;
  if ('active' in input) out.active = input.active ?? true;
  if ('startDate' in input) out.start_date = input.startDate ?? null;
  if ('endDate' in input) out.end_date = input.endDate ?? null;
  if ('photoUrl' in input) out.photo_url = input.photoUrl ?? null;
  if ('bio' in input) out.bio = input.bio ?? null;
  if ('notes' in input) out.notes = input.notes ?? null;
  if ('address' in input) out.address = input.address ?? null;
  if ('postalCode' in input) out.postal_code = input.postalCode ?? null;
  if ('city' in input) out.city = input.city ?? null;
  if ('country' in input) out.country = input.country ?? null;
  if ('cpr' in input) out.cpr = input.cpr ?? null;
  if ('taxCardType' in input) out.tax_card_type = input.taxCardType ?? null;
  if ('employmentType' in input) out.employment_type = input.employmentType ?? null;
  if ('salaryDkkMonthly' in input) out.salary_dkk_monthly = input.salaryDkkMonthly ?? null;
  if ('hourlyRateDkk' in input) out.hourly_rate_dkk = input.hourlyRateDkk ?? null;
  if ('birthday' in input) out.birthday = input.birthday ?? null;
  if ('primaryVehicleRegistration' in input) out.primary_vehicle_registration = input.primaryVehicleRegistration ?? null;
  return out;
};

export const EmployeesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('full_name');
      if (error) throw error;
      setEmployees((data ?? []).map(rowToEmployee));
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const addEmployee = async (input: EmployeeInput): Promise<Employee> => {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(inputToRow(input))
      .select()
      .single();
    if (error) throw error;
    const emp = rowToEmployee(data);
    setEmployees(prev => [...prev, emp].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    return emp;
  };

  const updateEmployee = async (id: string, updates: Partial<EmployeeInput>) => {
    const row = inputToRow(updates);
    if (Object.keys(row).length === 0) return;
    row.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from(TABLE)
      .update(row)
      .eq('id', id);
    if (error) throw error;
    setEmployees(prev =>
      prev
        .map(e => (e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    );
  };

  const countQuotesUsing = async (id: string): Promise<number> => {
    const { count, error } = await supabase
      .from('project_quotes_2026_01_16_23_00')
      .select('id', { count: 'exact', head: true })
      .eq('created_by_employee_id', id);
    if (error) throw error;
    return count ?? 0;
  };

  const removeEmployee = async (id: string) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  return (
    <EmployeesContext.Provider value={{ employees, loading, reload, addEmployee, updateEmployee, removeEmployee, countQuotesUsing }}>
      {children}
    </EmployeesContext.Provider>
  );
};

export const useEmployees = () => {
  const ctx = useContext(EmployeesContext);
  if (!ctx) throw new Error('useEmployees must be used within EmployeesProvider');
  return ctx;
};
