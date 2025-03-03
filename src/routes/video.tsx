import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useWebRTC } from "@/libs/core/rtc-context";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import {
  localStream,
  setDisplayStream,
} from "@/libs/stream";
import { devices } from "./setting";
import { sessionService } from "@/libs/services/session-service";
import { t } from "@/i18n";
import {
  Callout,
  CalloutContent,
  CalloutTitle,
} from "@/components/ui/callout";
import { Collapsible } from "@/components/ui/collapsible";

export interface VideoChatProps {}

const constraints = {
  video: {
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { max: 60 },
  },
  audio: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  },
} satisfies MediaStreamConstraints;

export default function Video() {
  if (!navigator.mediaDevices) {
    return (
      <div
        class="mx-auto flex min-h-[calc(100%_-_3rem)] flex-col items-center
          justify-center gap-8 p-4"
      >
        <h2 class="max-6-xs text-6xl font-thin uppercase">
          {t("video.no_support")}
        </h2>
        <p class="text-sm text-muted-foreground">
          {t("video.no_support_description")}
        </p>
      </div>
    );
  }

  const { roomStatus, remoteStreams } = useWebRTC();
  const openScreen = async () => {
    const local =
      await navigator.mediaDevices.getDisplayMedia({
        video: {
          ...constraints.video,
        },
        audio: {
          deviceId: devices.speaker?.deviceId,
          ...constraints.audio,
        },
      });

    setDisplayStream(local);
  };

  const openCamera = async () => {
    const local = await navigator.mediaDevices.getUserMedia(
      {
        video: {
          deviceId: devices.camera?.deviceId,
          ...constraints.video,
        },
        audio: {
          deviceId: devices.microphone?.deviceId,
          ...constraints.audio,
        },
      },
    );

    setDisplayStream(local);
  };

  const closeStream = async () => {
    setDisplayStream(null);
  };

  return (
    <div class="flex flex-col gap-2">
      <Callout variant="warning">
        <CalloutContent>
          The video chat feature is still under development
          and functionality may be unstable.
        </CalloutContent>
      </Callout>
      <div
        class="grid w-full grid-cols-1 place-content-center gap-2
          md:grid-cols-2"
      >
        <div class="relative aspect-video w-full overflow-hidden bg-muted">
          <Show
            when={localStream()}
            fallback={
              <div class="absolute inset-0 content-center text-center">
                {t("video.no_stream")}
              </div>
            }
          >
            {(stream) => (
              <video
                ref={(ref) => {
                  createEffect(() => {
                    ref.srcObject = stream();
                  });
                }}
                autoplay
                controls
                muted
                class="absolute inset-0 h-full w-full bg-black object-contain"
              ></video>
            )}
          </Show>
          <Show when={roomStatus.profile}>
            {(info) => (
              <div class="absolute left-1 top-1">
                <Badge
                  variant="outline"
                  class="text-xs text-white mix-blend-difference"
                >
                  Self
                </Badge>
              </div>
            )}
          </Show>
          <div class="absolute right-1 top-1 flex gap-1">
            <Show
              when={navigator.mediaDevices.getDisplayMedia}
            >
              <Button size="sm" onClick={openScreen}>
                {localStream()
                  ? t("common.action.change")
                  : t("common.action.open")}
                {t("video.device.screen")}
              </Button>
            </Show>
            <Show when={devices.camera}>
              <Button size="sm" onClick={openCamera}>
                {localStream()
                  ? t("common.action.change")
                  : t("common.action.open")}
                {t("video.device.camera")}
              </Button>
            </Show>

            <Show when={localStream()}>
              <Button
                size="sm"
                onClick={closeStream}
                variant="destructive"
              >
                {t("common.action.close")}
                {t("video.device.screen")}
              </Button>
            </Show>
          </div>
        </div>
        <For
          each={Object.values(
            sessionService.clientInfo,
          ).filter(
            (client) => client.onlineStatus === "online",
          )}
        >
          {(client) => (
            <Show
              when={remoteStreams[client.clientId]}
              // fallback={
              //   <div class="absolute inset-0 content-center text-center">
              //     No Stream
              //   </div>
              // }
            >
              {(stream) => (
                <div class="relative aspect-video w-full overflow-hidden bg-muted">
                  <video
                    autoplay
                    controls
                    ref={(ref) => {
                      createEffect(() => {
                        ref.srcObject = stream();
                      });
                    }}
                    class="absolute inset-0 h-full w-full bg-black object-contain"
                  />
                  <div class="absolute left-1 top-1 flex gap-1">
                    <Badge
                      variant="secondary"
                      class="bg-black/50 text-xs text-white hover:bg-black/80"
                    >
                      {client.name}
                    </Badge>
                    <Show when={client.candidateType}>
                      {(candidateType) => (
                        <Badge
                          variant="secondary"
                          class="bg-black/50 text-xs text-white hover:bg-black/80"
                        >
                          {candidateType()}
                        </Badge>
                      )}
                    </Show>
                  </div>
                </div>
              )}
            </Show>
          )}
        </For>
      </div>

      {/* <div class="h-auto overflow-x-auto text-xs">
          <pre>{JSON.stringify(devices(), null, 2)}</pre>
          <pre>{JSON.stringify(roomStatus, null, 2)}</pre>
        </div> */}
    </div>
  );
}
