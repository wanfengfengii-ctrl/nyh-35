import { ref } from 'vue'
import type { MessageApi, DialogApi, NotificationApi } from 'naive-ui'

const messageApi = ref<MessageApi | null>(null)
const dialogApi = ref<DialogApi | null>(null)
const notificationApi = ref<NotificationApi | null>(null)

export function setNotificationApis(
  message: MessageApi,
  dialog: DialogApi,
  notification?: NotificationApi
): void {
  messageApi.value = message
  dialogApi.value = dialog
  if (notification) {
    notificationApi.value = notification
  }
}

export function useNotify() {
  const success = (content: string): void => {
    messageApi.value?.success(content)
  }

  const warning = (content: string): void => {
    messageApi.value?.warning(content)
  }

  const error = (content: string): void => {
    messageApi.value?.error(content)
  }

  const info = (content: string): void => {
    messageApi.value?.info(content)
  }

  const loading = (content: string): { destroy: () => void } => {
    return messageApi.value?.loading(content, { duration: 0 }) || { destroy: () => {} }
  }

  return { success, warning, error, info, loading }
}

export function useDialog() {
  const confirm = (
    title: string,
    content: string,
    onPositive: () => void,
    options?: { positiveText?: string; negativeText?: string; type?: 'warning' | 'error' | 'info' }
  ): void => {
    dialogApi.value?.[options?.type || 'warning']({
      title,
      content,
      positiveText: options?.positiveText || '确认',
      negativeText: options?.negativeText || '取消',
      onPositiveClick: onPositive
    })
  }

  const confirmDelete = (name: string, onConfirm: () => void, extraHint?: string): void => {
    const content = extraHint
      ? `确定要删除「${name}」吗？${extraHint}此操作不可撤销。`
      : `确定要删除「${name}」吗？此操作不可撤销。`
    confirm('二次确认', content, onConfirm, { positiveText: '确认删除', type: 'error' })
  }

  return { confirm, confirmDelete }
}

export function useToast() {
  const show = (
    title: string,
    content: string,
    type: 'success' | 'warning' | 'error' | 'info' = 'info'
  ): void => {
    notificationApi.value?.create({
      title,
      content,
      type,
      duration: 3000
    })
  }

  return { show }
}
