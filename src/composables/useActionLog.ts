import { useReviewStore } from '@/stores/review'
import { useAppStore } from '@/stores/app'

export function useActionLog() {
  const reviewStore = useReviewStore()
  const appStore = useAppStore()

  function log(
    action: string,
    details: string,
    regionId: string | null = null,
    before: unknown | null = null,
    after: unknown | null = null
  ): void {
    reviewStore.addLog(
      action,
      details,
      regionId,
      before,
      after,
      appStore.currentAuthor
    )
  }

  function logCreate(targetType: string, name: string, extra = ''): void {
    log(
      `创建${targetType}`,
      `创建${targetType}「${name}」${extra ? ' - ' + extra : ''}`
    )
  }

  function logDelete(targetType: string, name: string, extra = ''): void {
    log(
      `删除${targetType}`,
      `删除${targetType}「${name}」${extra ? ' - ' + extra : ''}`
    )
  }

  function logUpdate(targetType: string, name: string, extra = ''): void {
    log(
      `更新${targetType}`,
      `更新${targetType}「${name}」${extra ? ' - ' + extra : ''}`
    )
  }

  function logRename(targetType: string, oldName: string, newName: string): void {
    log(
      `重命名${targetType}`,
      `${targetType}「${oldName}」更名为「${newName}」`
    )
  }

  return {
    log,
    logCreate,
    logDelete,
    logUpdate,
    logRename
  }
}
