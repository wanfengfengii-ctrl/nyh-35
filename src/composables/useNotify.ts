import { ref } from 'vue'
import type { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider'

export interface NotifyApi {
  info: (content: string, option?: any) => void
  success: (content: string, option?: any) => void
  warning: (content: string, option?: any) => void
  error: (content: string, option?: any) => void
}

const messageApi = ref<MessageApiInjection | null>(null)
const dialogApi = ref<DialogApiInjection | null>(null)
const notificationApi = ref<NotificationApiInjection | null>(null)

export function setMessageApi(api: MessageApiInjection) {
  messageApi.value = api
}

export function setDialogApi(api: DialogApiInjection) {
  dialogApi.value = api
}

export function setNotificationApi(api: NotificationApiInjection) {
  notificationApi.value = api
}

export function useNotify(): NotifyApi & {
  message: MessageApiInjection | null
  dialog: DialogApiInjection | null
  notification: NotificationApiInjection | null
} {
  const info = (content: string, _option?: any) => {
    messageApi.value?.info(content)
  }
  const success = (content: string, _option?: any) => {
    messageApi.value?.success(content)
  }
  const warning = (content: string, _option?: any) => {
    messageApi.value?.warning(content)
  }
  const error = (content: string, _option?: any) => {
    messageApi.value?.error(content)
  }

  return {
    info,
    success,
    warning,
    error,
    message: messageApi.value,
    dialog: dialogApi.value,
    notification: notificationApi.value
  }
}
