import { OfficeState } from './engine/officeState'

export interface SubagentInfo {
  toolId: string
  label: string
  sessionKey?: string
  childSessionKey?: string
  activityEvents?: Array<{ key: string; text: string; at: number }>
}

export interface AgentActivity {
  agentId: string
  name: string
  emoji: string
  state: 'idle' | 'working' | 'waiting' | 'offline'
  currentTool?: string
  toolStatus?: string
  lastActive: number
  subagents?: SubagentInfo[]
}

/** Track which subagent keys were active last sync, per parent agent */
const prevSubagentKeys = new Map<string, Set<string>>()

/** Track previous agent states to detect offline→working transitions */
const prevAgentStates = new Map<string, string>()

function stateLabel(state: AgentActivity['state']): string {
  if (state === 'working') return 'working'
  if (state === 'waiting') return 'waiting'
  if (state === 'idle') return 'idle'
  return 'offline'
}

export function syncAgentsToOffice(
  activities: AgentActivity[],
  office: OfficeState,
  agentIdMap: Map<string, number>,
  nextIdRef: { current: number },
): void {
  const currentAgentIds = new Set(activities.map(a => a.agentId))

  // Remove agents that are no longer present
  for (const [agentId, charId] of agentIdMap) {
    if (!currentAgentIds.has(agentId)) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMap.delete(agentId)
      prevSubagentKeys.delete(agentId)
    }
  }

  for (const activity of activities) {
    let charId = agentIdMap.get(activity.agentId)
    if (charId !== undefined && !office.characters.has(charId)) {
      agentIdMap.delete(activity.agentId)
      charId = undefined
    }
    if (charId === undefined) {
      charId = nextIdRef.current++
      agentIdMap.set(activity.agentId, charId)
      // Spawn at door if agent was previously offline or is brand new
      const wasOffline = prevAgentStates.get(activity.agentId) === 'offline'
      const isNew = !prevAgentStates.has(activity.agentId)
      office.addAgent(charId, undefined, undefined, undefined, undefined, wasOffline || isNew)
    }

    // Set label, avoiding duplicated values like "main (main)"
    const ch = office.characters.get(charId)
    if (ch) {
      const displayName = activity.name?.trim()
      const baseLabel = displayName && displayName !== activity.agentId
        ? `${displayName} (${activity.agentId})`
        : activity.agentId
      ch.label = `${baseLabel} • ${stateLabel(activity.state)}`
    }

    switch (activity.state) {
      case 'working':
        office.setAgentActive(charId, false)
        office.setAgentTool(charId, activity.currentTool || null)
        office.sendAgentToZone(charId, 'office')
        break
      case 'idle':
        office.setAgentActive(charId, false)
        office.setAgentTool(charId, null)
        office.sendAgentToZone(charId, 'lounge')
        break
      case 'waiting':
        office.setAgentActive(charId, false)
        office.sendAgentToZone(charId, 'office')
        office.showWaitingBubble(charId)
        break
      case 'offline':
        office.setAgentActive(charId, false)
        office.setAgentTool(charId, null)
        office.sendAgentToZone(charId, 'lounge')
        break
    }

    // Sync subagents
    const currentSubKeys = new Set<string>()
    if (activity.state !== 'offline' && activity.subagents) {
      for (const sub of activity.subagents) {
        const subKey = sub.sessionKey ? `${sub.sessionKey}::${sub.toolId}` : sub.toolId
        currentSubKeys.add(subKey)
        const existingSubId = office.getSubagentId(charId, subKey)
        if (existingSubId === null) {
          const subId = office.addSubagent(charId, subKey)
          office.setAgentActive(subId, true)
          const subCh = office.characters.get(subId)
          if (subCh) subCh.label = office.getTempWorkerLabel()
        } else {
          const subCh = office.characters.get(existingSubId)
          if (subCh) {
            subCh.label = office.getTempWorkerLabel()
            office.setAgentActive(existingSubId, true)
          }
        }
      }
    }

    // Remove subagents that are no longer active
    const prevKeys = prevSubagentKeys.get(activity.agentId)
    if (prevKeys) {
      for (const subKey of prevKeys) {
        if (!currentSubKeys.has(subKey)) {
          office.removeSubagent(charId, subKey)
        }
      }
    }
    prevSubagentKeys.set(activity.agentId, currentSubKeys)
    prevAgentStates.set(activity.agentId, activity.state)
  }
}
