import {
  EventHandler,
  MultiEventEmitter,
} from "@/libs/utils/event-emitter";
import {
  comparePasswordHash,
  hashPassword,
} from "../../utils/encrypt";
import { WebSocketSignalingService } from "../signaling/ws-signaling-service";
import {
  ClientServiceEventMap,
  RawSignal,
  TransferClient,
} from "../type";
import {
  ClientService,
  ClientServiceInitOptions,
} from "../type";
import { UpdateClientOptions } from "./firebase-client-service";
import { toast } from "solid-sonner";

export class WebSocketClientService
  implements ClientService
{
  private eventEmitter =
    new MultiEventEmitter<ClientServiceEventMap>();
  private roomId: string;
  private password: string | null;
  private client: TransferClient;
  private socket: WebSocket | null = null;
  private controller: AbortController =
    new AbortController();
  private signalingServices: Map<
    string,
    WebSocketSignalingService
  > = new Map();

  private eventListeners: Map<string, Array<Function>> =
    new Map();

  private maxReconnectAttempts = 3;
  private reconnectAttempts = 0;
  private reconnectInterval = 3000;
  private websocketUrl: string;

  get info() {
    return this.client;
  }

  constructor({
    roomId,
    password,
    client,
    websocketUrl,
  }: ClientServiceInitOptions) {
    this.roomId = roomId;
    this.password = password;
    this.client = { ...client, createdAt: Date.now() };
    this.websocketUrl =
      websocketUrl ?? import.meta.env.VITE_WEBSOCKET_URL;
    window.addEventListener(
      "beforeunload",
      () => {
        this.destroy();
      },
      { signal: this.controller.signal },
    );
    window.addEventListener(
      "unload",
      () => {
        this.destroy();
      },
      { signal: this.controller.signal },
    );
    document.addEventListener(
      "visibilitychange",
      (ev) => {
        if (document.visibilityState === "visible") {
          if (this.socket?.readyState !== WebSocket.OPEN) {
            this.reconnect();
          }
        }
      },
      { signal: this.controller.signal },
    );
  }

  private dispatchEvent<
    K extends keyof ClientServiceEventMap,
  >(event: K, data: ClientServiceEventMap[K]) {
    return this.eventEmitter.dispatchEvent(event, data);
  }

  addEventListener<K extends keyof ClientServiceEventMap>(
    event: K,
    callback: EventHandler<ClientServiceEventMap[K]>,
    options?: boolean | AddEventListenerOptions,
  ): void {
    return this.eventEmitter.addEventListener(
      event,
      callback,
      options,
    );
  }

  removeEventListener<
    K extends keyof ClientServiceEventMap,
  >(
    event: K,
    callback: EventHandler<ClientServiceEventMap[K]>,
    options?: boolean | AddEventListenerOptions,
  ): void {
    return this.eventEmitter.removeEventListener(
      event,
      callback,
      options,
    );
  }

  private async initialize(resume?: boolean) {
    const wsUrl = new URL(this.websocketUrl);

    wsUrl.searchParams.append("room", this.roomId);
    if (this.password) {
      try {
        const hash = await hashPassword(this.password);
        wsUrl.searchParams.append("pwd", hash);
      } catch (error) {
        console.error(error);
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error("failed to hash password");
        }
        this.password = null;
      }
    }
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("message", (ev) => {
      const signal: RawSignal = JSON.parse(ev.data);
      switch (signal.type) {
        case "join":
          this.emit("join", signal.data as TransferClient);
          break;
        case "leave":
          this.emit("leave", signal.data as TransferClient);
          break;
        case "ping":
          socket.send(JSON.stringify({ type: "pong" }));
        default:
          break;
      }
    });

    socket.addEventListener(
      "close",
      () => this.reconnect(),
      {
        signal: this.controller.signal,
      },
    );

    this.controller.signal.addEventListener("abort", () => {
      this.dispatchEvent("status-change", "disconnected");
    });

    this.socket = socket;

    return new Promise<WebSocket>((resolve, reject) => {
      this.dispatchEvent("status-change", "connecting");
      let timer = window.setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
        this.destroy();
      }, 10000);
      socket.addEventListener(
        "open",
        () => clearTimeout(timer),
        { once: true },
      );

      socket.addEventListener(
        "error",
        () => {
          reject(new Error(`WebSocket error occurred`));
          this.destroy();
        },
        { once: true, signal: this.controller.signal },
      );
      socket.addEventListener(
        "message",
        async (ev) => {
          const message = JSON.parse(ev.data) as RawSignal;
          if (message.type === "connected") {
            const passwordHash = message.data;
            if (passwordHash) {
              if (!this.password) {
                this.destroy();
                return reject(
                  new Error("password required"),
                );
              }

              const passwordMatch =
                await comparePasswordHash(
                  this.password,
                  passwordHash,
                );
              if (!passwordMatch) {
                this.destroy();
                return reject(
                  new Error("incorrect password"),
                );
              }
            } else {
              this.password = null;
              toast.error(
                "the room is not password protected",
              );
            }
            socket.send(
              JSON.stringify({
                type: "join",
                data: { ...this.client, resume },
              }),
            );
            this.dispatchEvent(
              "status-change",
              "connected",
            );
            resolve(socket);
          } else if (message.type === "error") {
            reject(new Error(message.data));
            this.destroy();
          }
        },
        { once: true, signal: this.controller.signal },
      );
    });
  }

  private async reconnect() {
    try {
      await this.initialize(true);

      this.signalingServices.forEach((service) => {
        service.setSocket(this.socket!);
      });

      this.reconnectAttempts = 0;
      console.log(`Reconnect success`);
    } catch (error) {
      this.reconnectAttempts++;
      console.log(
        `Reconnect failed, attempt: ${this.reconnectAttempts}`,
      );
      if (
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        setTimeout(
          () => this.reconnect(),
          this.reconnectInterval,
        );
      } else {
        console.log(
          `Reach max reconnect attempts, send leave message`,
        );
        this.destroy();
      }
    }
  }

  getSender(
    targetClientId: string,
  ): WebSocketSignalingService {
    let service =
      this.signalingServices.get(targetClientId);
    if (!service) {
      if (!this.socket) {
        throw Error("WebSocket not init yet");
      }
      service = new WebSocketSignalingService(
        this.socket,
        this.client.clientId,
        targetClientId,
        this.password,
      );
      this.signalingServices.set(targetClientId, service);
    }
    return service;
  }
  removeSender(targetClientId: string) {
    const service =
      this.signalingServices.get(targetClientId);
    if (service) {
      service.destroy();
      this.signalingServices.delete(targetClientId);
    }
  }
  listenForJoin(
    callback: (client: TransferClient) => void,
  ) {
    this.on("join", callback);
  }

  listenForLeave(
    callback: (client: TransferClient) => void,
  ) {
    this.on("leave", callback);
  }
  async createClient() {
    await this.initialize();
  }
  destroy() {
    this.dispatchEvent("status-change", "disconnected");
    this.signalingServices.forEach((service) =>
      service.destroy(),
    );
    this.eventListeners.clear();

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "leave",
            data: this.client,
          }),
        );
      }
      this.socket = null;
    }

    this.controller.abort();
  }
  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach((callback) => callback(data));
  }

  private on(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  async updateClient(options: UpdateClientOptions) {
    this.client.name = options.name ?? this.client.name;
  }
}
