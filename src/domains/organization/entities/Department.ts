export enum DepartmentStatus {
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Department {
  id:          string
  tenantId:    string
  name:        string
  slug:        string
  description: string | null
  status:      DepartmentStatus
  createdAt:   Date
  updatedAt:   Date
}

export interface CreateDepartmentData {
  tenantId:     string
  name:         string
  slug:         string
  description?: string
}

export interface UpdateDepartmentData {
  name?:        string
  slug?:        string
  description?: string
  status?:      DepartmentStatus
}
