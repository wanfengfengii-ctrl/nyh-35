import { ref, computed } from 'vue'
import type { IssueFilter, IssueStatus, IssuePriority, BreakSeverity, BreakType } from '@/types'
import { useIssueStore } from '@/stores/issue'

export function useIssueFilter() {
  const issueStore = useIssueStore()

  const statusFilter = ref<IssueStatus[]>([])
  const priorityFilter = ref<IssuePriority[]>([])
  const severityFilter = ref<BreakSeverity[]>([])
  const breakTypeFilter = ref<BreakType[]>([])
  const keywordFilter = ref('')
  const assigneeFilter = ref<string | null>(null)
  const dueDateFrom = ref<number | null>(null)
  const dueDateTo = ref<number | null>(null)

  const filteredIssues = computed(() => issueStore.filteredIssues)

  function applyFilters(): void {
    const filter: IssueFilter = {
      status: statusFilter.value.length > 0 ? statusFilter.value : undefined,
      priority: priorityFilter.value.length > 0 ? priorityFilter.value : undefined,
      severity: severityFilter.value.length > 0 ? severityFilter.value : undefined,
      assignee: assigneeFilter.value !== undefined ? assigneeFilter.value : undefined,
      breakType: breakTypeFilter.value.length > 0 ? breakTypeFilter.value : undefined,
      keyword: keywordFilter.value || undefined,
      dueDateFrom: dueDateFrom.value || undefined,
      dueDateTo: dueDateTo.value || undefined
    }
    issueStore.setIssueFilter(filter)
  }

  function resetFilters(): void {
    statusFilter.value = []
    priorityFilter.value = []
    severityFilter.value = []
    breakTypeFilter.value = []
    keywordFilter.value = ''
    assigneeFilter.value = null
    dueDateFrom.value = null
    dueDateTo.value = null
    issueStore.setIssueFilter({})
  }

  return {
    statusFilter,
    priorityFilter,
    severityFilter,
    breakTypeFilter,
    keywordFilter,
    assigneeFilter,
    dueDateFrom,
    dueDateTo,
    filteredIssues,
    applyFilters,
    resetFilters
  }
}
