import {
  equalTo,
  get,
  getDatabase,
  onChildAdded,
  onDisconnect,
  orderByChild,
  push,
  query,
  ref,
  remove,
} from "firebase/database";

import { app } from "@/libs/firebase";
import { v4 } from "uuid";
import {
  RawSignal,
  ClientSignal,
  SignalingService,
  Unsubscribe,
  SignalingServiceEventMap,
} from "../type";
import {
  decryptData,
  encryptData,
} from "@/libs/core/utils/encrypt/e2e";
import { EventHandler } from "@/libs/utils/event-emitter";

export class FirebaseSignalingService
  implements SignalingService
{
  private signalsRef;
  private db = getDatabase(app);
  private _clientId: string;
  private _targetClientId: string;
  private password: string | null = null;
  private listeners: Record<
    string,
    {
      callback: string;
      unsubscribe: Unsubscribe;
    }[]
  > = {};

  constructor(
    roomId: string,
    clientId: string,
    targetClientId: string,
    password: string | null,
  ) {
    this._targetClientId = targetClientId;
    this._clientId = clientId;
    this.signalsRef = ref(
      this.db,
      `rooms/${roomId}/signals`,
    );
    this.password = password;
  }

  get clientId(): string {
    return this._clientId;
  }

  get targetClientId(): string {
    return this._targetClientId;
  }

  addEventListener<
    K extends keyof SignalingServiceEventMap,
  >(
    event: K,
    callback: EventHandler<SignalingServiceEventMap[K]>,
    options?: boolean | AddEventListenerOptions,
  ): void {
    const unsubscribe = this.listenForSignal((signal) => {
      if (typeof options !== "boolean") {
        if (options?.once) {
          unsubscribe();
        }
        if (options?.signal) {
          options.signal.addEventListener("abort", () => {
            unsubscribe();
          });
        }
      }
      callback(new CustomEvent(event, { detail: signal }));
    });
    this.listeners[event] = [
      ...(this.listeners[event] || []),
      { callback: callback.toString(), unsubscribe },
    ];
  }

  removeEventListener<
    K extends keyof SignalingServiceEventMap,
  >(
    event: K,
    callback: EventHandler<SignalingServiceEventMap[K]>,
    options?: boolean | EventListenerOptions,
  ): void {
    const unsubscribe = this.listeners[event].find(
      (listener) =>
        listener.callback === callback.toString(),
    )?.unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      this.listeners[event] = this.listeners[event].filter(
        (listener) =>
          listener.callback !== callback.toString(),
      );
    }
  }

  async sendSignal({
    type,
    data,
  }: RawSignal): Promise<void> {
    let sendData = data;
    if (this.password) {
      sendData = await encryptData(this.password, sendData);
    }

    const singnalRef = await push(this.signalsRef, {
      type: type,
      data: sendData,
      clientId: this._clientId,
      targetClientId: this._targetClientId,
    });
    onDisconnect(singnalRef).remove();
  }

  private listenForSignal(
    callback: (signal: ClientSignal) => void,
  ) {
    return onChildAdded(
      this.signalsRef,
      async (snapshot) => {
        const message = snapshot.val() as ClientSignal;
        if (!message) return;
        if (message.clientId === this._clientId) return;
        if (message.clientId !== this._targetClientId)
          return;
        if (
          message.targetClientId &&
          message.targetClientId !== this._clientId
        )
          return;
        remove(snapshot.ref);
        if (this.password) {
          message.data = await decryptData(
            this.password,
            message.data,
          );
        }
        message.data = JSON.parse(message.data);
        callback(message);
      },
    );
  }

  async clearSignals() {
    const snapshot = await get(this.signalsRef);

    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val() as ClientSignal;
      if (data && data.targetClientId === this._clientId)
        remove(childSnapshot.ref);
    });
  }

  async destroy() {
    await this.clearSignals();
    Object.values(this.listeners).forEach((listeners) => {
      listeners.forEach((listener) => {
        listener.unsubscribe();
      });
    });
  }
}
