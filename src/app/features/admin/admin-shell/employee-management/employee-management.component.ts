import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { EmployeesService, type Employee } from '../../../../core/services/employees.service';

type EmployeeRole = 'supervisor' | 'employee';

@Component({
  selector: 'app-employee-management',
  templateUrl: './employee-management.component.html',
  styleUrls: ['./employee-management.component.scss']
})
export class EmployeeManagementComponent implements OnInit {
  employees: Employee[] = [];
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  modalErrorMessage = '';
  isModalOpen = false;
  editingEmployee: Employee | null = null;

  form!: FormGroup;

  readonly roleOptions: { value: EmployeeRole; label: string }[] = [
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'employee', label: 'Employee' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly employeesService: EmployeesService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: [''],
      role: ['employee', [Validators.required]]
    });

    this.loadEmployees();
  }

  loadEmployees(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.employeesService.listEmployees().pipe(finalize(() => (this.isLoading = false))).subscribe({
      next: (employees) => {
        this.employees = Array.isArray(employees) ? employees : [];
      },
      error: () => {
        this.errorMessage = 'Unable to load employees.';
      }
    });
  }

  openCreateModal(): void {
    this.editingEmployee = null;
    this.modalErrorMessage = '';
    this.form.enable({ emitEvent: false });
    this.form.get('email')?.setValidators([Validators.required, Validators.email]);
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('email')?.updateValueAndValidity({ emitEvent: false });
    this.form.get('password')?.updateValueAndValidity({ emitEvent: false });
    this.form.reset({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'employee'
    });
    this.isModalOpen = true;
  }

  openEditModal(employee: Employee): void {
    this.editingEmployee = employee;
    this.modalErrorMessage = '';
    this.form.reset({
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      password: '',
      phone: employee?.phone ?? '',
      role: (employee?.role as EmployeeRole) ?? 'employee'
    });
    this.form.get('email')?.disable({ emitEvent: false });
    this.form.get('password')?.clearValidators();
    this.form.get('password')?.disable({ emitEvent: false });
    this.form.get('password')?.updateValueAndValidity({ emitEvent: false });
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.editingEmployee = null;
    this.modalErrorMessage = '';
    this.form.enable({ emitEvent: false });
    this.form.reset({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'employee'
    });
  }

  submitModal(): void {
    if (this.isSaving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue() as any;
    const name = String(raw?.name ?? '').trim();
    const email = String(raw?.email ?? '').trim();
    const password = String(raw?.password ?? '');
    const phone = String(raw?.phone ?? '').trim();
    const role = String(raw?.role ?? '').trim();

    this.isSaving = true;
    this.modalErrorMessage = '';

    if (this.editingEmployee) {
      const id = String(this.editingEmployee?.id ?? '').trim();
      this.employeesService
        .updateEmployee(id, { name, phone: phone || undefined, role: role || undefined })
        .pipe(finalize(() => (this.isSaving = false)))
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadEmployees();
          },
          error: () => {
            this.modalErrorMessage = 'Unable to update employee.';
          }
        });
      return;
    }

    this.employeesService
      .createEmployee(name, email, password, phone || undefined, role || undefined)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => {
          this.closeModal();
          this.loadEmployees();
        },
        error: () => {
          this.modalErrorMessage = 'Unable to create employee.';
        }
      });
  }

  setActive(employeeId: string, isActive: boolean): void {
    const id = String(employeeId ?? '').trim();
    if (!id) return;
    this.errorMessage = '';
    this.employeesService.setEmployeeActive(id, isActive).subscribe({
      next: () => this.loadEmployees(),
      error: () => {
        this.errorMessage = isActive ? 'Unable to activate employee.' : 'Unable to deactivate employee.';
      }
    });
  }

  deleteEmployee(employeeId: string): void {
    const id = String(employeeId ?? '').trim();
    if (!id) return;
    const ok = confirm('Delete this employee? This cannot be undone.');
    if (!ok) return;
    this.errorMessage = '';
    this.isSaving = true;
    this.employeesService
      .deleteEmployee(id)
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => this.loadEmployees(),
        error: () => {
          this.errorMessage = 'Unable to delete employee.';
        }
      });
  }

  trackByEmployeeId(_: number, e: Employee): string {
    return String(e?.id ?? '');
  }
}
