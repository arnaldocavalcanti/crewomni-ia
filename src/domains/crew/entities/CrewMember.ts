export enum CrewMemberRole {
  DIRECTOR = 'DIRECTOR',
  MEMBER   = 'MEMBER',
  OBSERVER = 'OBSERVER',
}

export interface CrewMember {
  id:         string
  tenantId:   string
  crewId:     string
  agentId:    string
  role:       CrewMemberRole
  order:      number
  isRequired: boolean
  createdAt:  Date
}

export interface CreateCrewMemberData {
  tenantId:    string
  crewId:      string
  agentId:     string
  role:        CrewMemberRole
  order:       number
  isRequired?: boolean
}
