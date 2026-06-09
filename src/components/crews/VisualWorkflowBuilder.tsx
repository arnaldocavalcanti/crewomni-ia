'use client'

import React, { useCallback } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const initialNodes = [
  { id: 'start', position: { x: 100, y: 100 }, data: { label: 'Início' }, type: 'input' },
  { id: '1', position: { x: 100, y: 200 }, data: { label: 'Agente: Triagem' } },
  { id: '2', position: { x: 100, y: 300 }, data: { label: 'Agente: Especialista' } },
]

const initialEdges: Edge[] = [
  { id: 'e-start-1', source: 'start', target: '1' },
  { id: 'e1-2', source: '1', target: '2', label: 'escalar', animated: true },
]

export default function VisualWorkflowBuilder({ crewId }: { crewId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleSave = () => {
    console.log('Salvando workflow...', { crewId, nodes, edges })
    // No futuro integrará com a API /api/v1/crews/[crewId]/workflow
  }

  return (
    <div className="h-[600px] w-full border border-border rounded-xl bg-card overflow-hidden">
      <div className="p-4 border-b border-border flex justify-between items-center bg-card">
        <div>
          <h3 className="font-semibold text-foreground">Visual Workflow Builder</h3>
          <p className="text-sm text-muted-foreground">Desenhando o fluxo da Crew: {crewId}</p>
        </div>
        <button 
          onClick={handleSave}
          className="px-4 py-2 bg-foreground text-background text-sm rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Salvar Workflow
        </button>
      </div>
      <div className="h-[calc(100%-73px)] w-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background gap={12} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}
