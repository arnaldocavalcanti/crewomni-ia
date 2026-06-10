'use client'

import type { FlowPathEntry, HandoffEntry } from '@/domains/crew/entities/TestSessionResult'

type CrewMember = {
  agentId: string
  agentName: string
  role: 'DIRECTOR' | 'MEMBER' | 'OBSERVER'
}

type Props = {
  members: CrewMember[]
  flowPath: FlowPathEntry[]
  handoffs: HandoffEntry[]
  isRunning: boolean
}

export function CrewFlowDiagram({ members, flowPath, handoffs, isRunning }: Props) {
  const visitedIds = new Set(flowPath.map((f) => f.agentId))

  function nodeColor(member: CrewMember): string {
    if (!visitedIds.has(member.agentId)) return '#e5e7eb'
    return member.role === 'DIRECTOR' ? '#4F6EF7' : '#7C3AED'
  }

  function nodeTextColor(member: CrewMember): string {
    return visitedIds.has(member.agentId) ? '#ffffff' : '#6b7280'
  }

  function getBadge(member: CrewMember): string | null {
    const entry = flowPath.find((f) => f.agentId === member.agentId)
    if (!entry) return null
    if (entry.action === 'RESPONDED') return `✓ ${entry.durationMs}ms`
    if (entry.action === 'TRANSFERRED') return '⇄'
    if (entry.action === 'WAITING' && isRunning) return '⏳'
    return null
  }

  const NODE_W = 200
  const NODE_H = 44
  const ENTRY_H = 32
  const HARNESS_H = 32
  const GAP = 48
  const TRANSFER_H = 28
  const SVG_W = 340

  const memberCount = members.length
  const membersHeight = memberCount * NODE_H + (memberCount - 1) * (GAP + TRANSFER_H)
  const totalH = ENTRY_H + GAP + HARNESS_H + GAP + membersHeight + 24

  const cx = SVG_W / 2
  let y = 16

  const entryY = y
  y += ENTRY_H + GAP
  const harnessY = y
  y += HARNESS_H + GAP

  const memberNodes = members.map((m, i) => {
    const nodeY = y
    y += NODE_H
    if (i < members.length - 1) y += GAP + TRANSFER_H
    return { member: m, y: nodeY }
  })

  return (
    <div className="flex-1 overflow-auto p-4 bg-muted/20 flex justify-center">
      <svg width={SVG_W} height={totalH} viewBox={`0 0 ${SVG_W} ${totalH}`} className="overflow-visible">

        <rect x={cx - NODE_W / 2} y={entryY} width={NODE_W} height={ENTRY_H} rx={16} fill="#06C8E8" />
        <text x={cx} y={entryY + ENTRY_H / 2 + 5} textAnchor="middle" fontSize={11} fontWeight="600" fill="#fff">
          📥 WhatsApp
        </text>

        <line x1={cx} y1={entryY + ENTRY_H} x2={cx} y2={harnessY} stroke="#4F6EF7" strokeWidth={2} />

        <rect x={cx - NODE_W / 2} y={harnessY} width={NODE_W} height={HARNESS_H} rx={6}
          fill="rgba(79,110,247,0.06)" stroke="#4F6EF7" strokeWidth={1.5} strokeDasharray="5,3" />
        <text x={cx} y={harnessY + HARNESS_H / 2 + 5} textAnchor="middle" fontSize={10} fill="#4F6EF7" fontWeight="600">
          Harness · idempotência OK
        </text>

        {memberNodes.map(({ member, y: my }, i) => {
          const isVisited = visitedIds.has(member.agentId)
          const badge = getBadge(member)
          const transferEntry = handoffs.find((h) => h.toAgentId === member.agentId)
          const prevY = i === 0 ? harnessY + HARNESS_H : memberNodes[i - 1].y + NODE_H

          return (
            <g key={member.agentId} opacity={isVisited ? 1 : 0.35}>
              <line x1={cx} y1={prevY} x2={cx} y2={my} stroke={isVisited ? '#4F6EF7' : '#d1d5db'} strokeWidth={2} />

              {i > 0 && (
                <g>
                  <rect x={cx - 80} y={prevY + (my - prevY) / 2 - 11} width={160} height={22} rx={11}
                    fill={transferEntry ? '#f3f0ff' : '#f3f4f6'} />
                  <text x={cx} y={prevY + (my - prevY) / 2 + 5} textAnchor="middle" fontSize={10}
                    fill={transferEntry ? '#7C3AED' : '#9ca3af'} fontWeight="600">
                    {transferEntry ? '⇄ TransferConversation' : '↓'}
                  </text>
                </g>
              )}

              <rect x={cx - NODE_W / 2} y={my} width={NODE_W} height={NODE_H} rx={10}
                fill={nodeColor(member)}
                style={{ filter: isVisited ? 'drop-shadow(0 3px 8px rgba(79,110,247,0.3))' : 'none' }} />
              <text x={cx} y={my + NODE_H / 2 - 4} textAnchor="middle" fontSize={12}
                fontWeight="700" fill={nodeTextColor(member)}>
                🤖 {member.agentName}
              </text>
              <text x={cx} y={my + NODE_H / 2 + 11} textAnchor="middle" fontSize={10}
                fill={isVisited ? 'rgba(255,255,255,0.8)' : '#9ca3af'}>
                {member.role}
              </text>

              {badge && (
                <g>
                  <rect x={cx + NODE_W / 2 - 52} y={my - 10} width={52} height={20} rx={10}
                    fill={badge.startsWith('✓') ? '#22c55e' : '#f59e0b'} />
                  <text x={cx + NODE_W / 2 - 26} y={my + 5} textAnchor="middle" fontSize={9}
                    fontWeight="700" fill="#fff">
                    {badge}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
