import type { CrewWorkflow } from '../entities/CrewWorkflow'

export type ExecuteWorkflowParams = {
  workflow: CrewWorkflow
  conversationId: string
  tenantId: string
  inputMessage: string
  currentState: any | null
}

export type ExecuteWorkflowResult = {
  response: string | null
  newState: any
  isFinished: boolean
}

export interface IWorkflowExecutor {
  execute(params: ExecuteWorkflowParams): Promise<ExecuteWorkflowResult>
}
