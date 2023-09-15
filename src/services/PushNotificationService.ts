import { FCM } from "@capacitor-community/fcm"
import { Capacitor } from "@capacitor/core"
import {
  PushNotifications,
  PushNotificationSchema,
  Token,
} from "@capacitor/push-notifications"
import { error } from "console"

export default class PushNotificationService {
  private onRegistrationActions: ((token: string) => Promise<void>)[] = []
  private onNotificationReceivedActions: ((data: any) => Promise<void>)[] = []
    private registerTokenFn: (token: string) => void

  constructor(registerTokenFn: any) {
    this.registerTokenFn = registerTokenFn
  }

  public async init(): Promise<void> {
    const platform = Capacitor.getPlatform()

    if (platform === "web")
      throw new UnSupportedNotificationException(
        "PushNotification not supported for web"
      )

    // Request permission to use push notifications
    // iOS will prompt user and return if they granted permission or not
    // Android and web will just grant without prompting
    const permStatus = await PushNotifications.requestPermissions()

    if (permStatus.receive !== "granted") {
      throw new UnAuthorizedNotificationException(
        "PushNotification permission refused"
      )
    }

    PushNotifications.addListener("registration", async ({ value }) => {
      let token

      // Get FCM token instead the APN one returned by Capacitor
      if (platform === "ios") {
        const { token: fcm_token } = await FCM.getToken()
        token = fcm_token
      } else if (platform === "android") {
        token = value
      } else {
        throw new Error(`Unsupported platform "${platform}"`)
      }

      await this.doActions(this.onRegistrationActions, token)
      console.log("PushNotification initialized")
    })

    await PushNotifications.addListener("registrationError", (err) => {
      console.error("Registration error: ", err.error)
    })

    await PushNotifications.addListener(
      "pushNotificationReceived",
      async (notification) => {
        await this.doActions(this.onNotificationReceivedActions, notification)
      }
    )

    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        console.log(
          "Push notification action performed",
          notification.actionId,
          notification.inputValue
        )
      }
    )

    await PushNotifications.register()
  }

  public onNotificationReceived(
    callback: (data: any) => Promise<void>
  ): PushNotificationService {
    this.onNotificationReceivedActions.push(callback)
    return this
  }

  public onRegistration(
    callback: (data: any) => Promise<void>
  ): PushNotificationService {
    this.onRegistrationActions.push(callback)
    return this
  }

  private async doActions(
    callbacks: ((param: any) => Promise<void>)[],
    param: any
  ) {
    for (const callback of callbacks) {
      callback(param)
    }
  }

  public async registerAccountForPushNotification(
    accountUrl: string,
    token: string
  ) {
    try {
      console.log("registering " + accountUrl + " " + token)
      //ToDo in LokaAPI
      //this.lokAPI.registerAccountForPushNotification(accountUrl, token)
    } catch (e) {
      //ToDo
    }
  }
}

export class UnAuthorizedNotificationException extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class UnSupportedNotificationException extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}
