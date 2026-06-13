export enum CrewStatus {
  DRAFT    = 'DRAFT',
  ACTIVE   = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Crew {
  id:           string
  tenantId:     string
  departmentId: string
  name:         string
  slug:         string
  description:  string | null
  objective:                  string | null
  humanHandoffWhatsappNumber: string | null
  humanHandoffWebhookUrl:     string | null
  status:                     CrewStatus
  createdAt:    Date
  updatedAt:    Date
}

export interface CreateCrewData {
  tenantId:     string
  departmentId: string
  name:         string
  slug:         string
  description?: string
  objective?:   string
}

export interface UpdateCrewData {
  name?:        string
  slug?:        string
  description?: string
  objective?:   string
  status?:      CrewStatus
}
