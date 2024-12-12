import {
  Accessor,
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
import { sessionService } from "@/libs/services/session-service";
import { t } from "@/i18n";
import {
  Callout,
  CalloutContent,
  CalloutTitle,
} from "@/components/ui/callout";
import {
  IconClose,
  IconCropSquare,
  IconMic,
  IconMicFilled,
  IconScreenShare,
  IconStopScreenShare,
  IconVideoCam,
  IconVolumeOff,
  IconVolumeUp,
  IconVolumeUpFilled,
  IconWindow,
} from "@/components/icons";
import { makePersisted } from "@solid-primitives/storage";
import {
  Tabs,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/libs/cn";
import { ClientInfo } from "@/libs/core/type";
import { createIsMobile } from "@/libs/hooks/create-mobile";
import { Dynamic } from "solid-js/web";
import { createCheckVolume } from "@/libs/hooks/check-volume";
import { createMediaSelectionDialog } from "@/components/media-selection-dialog";
import { createStore } from "solid-js/store";

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

  const { roomStatus } = useWebRTC();

  const [showWarning, setShowWarning] = makePersisted(
    createSignal(true),
    {
      name: "video-warning",
      storage: localStorage,
    },
  );
  const isMobile = createIsMobile();

  const [tab, setTab] = createSignal(
    isMobile() ? "1" : "2",
  );

  createEffect(() => {
    setTab(isMobile() ? "1" : "2");
  });

  const [speaking, setSpeaking] = createStore<
    Array<[string, Accessor<boolean>]>
  >([]);

  createEffect(() => {
    const localTracks = localStream()
      ?.getAudioTracks()
      .map((track) => {
        return [
          track.contentHint,
          createCheckVolume(() => new MediaStream([track])),
        ] as [string, Accessor<boolean>];
      });
    setSpeaking(localTracks ?? []);
  });

  const anySpeaking = createMemo(() => {
    return speaking.some(([_, speak]) => speak());
  });

  return (
    <>
      <Tabs
        value={tab()}
        onChange={(value) => setTab(value)}
        class="flex size-full flex-col"
        defaultValue="2"
      >
        <div
          class="sticky top-[var(--mobile-header-height)] z-10 flex h-12
            w-full items-center justify-between border-b border-border
            bg-background/50 px-4 backdrop-blur sm:top-0"
        >
          <h4 class="h4">
            {t("video.title")}
            {roomStatus.roomId
              ? ` - ${roomStatus.roomId}`
              : ""}
          </h4>
          <TabsList class="w-min">
            <TabsTrigger value="2">
              <IconWindow class="size-4" />
            </TabsTrigger>
            <TabsTrigger value="1">
              <IconCropSquare class="size-4" />
            </TabsTrigger>
            <TabsIndicator />
          </TabsList>
        </div>
        <Show when={showWarning()}>
          <Callout variant="warning" class="relative">
            <CalloutContent>
              The video chat feature is still under
              development and functionality may be unstable.
            </CalloutContent>
            <button
              class="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setShowWarning(false)}
            >
              <IconClose class="size-4" />
            </button>
          </Callout>
        </Show>

        <div
          class={cn(
            "grid w-full place-content-center gap-2",
            tab() == "1" ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          <div
            class="relative aspect-video
              max-h-[calc(100vh-3rem-var(--mobile-header-height))] w-full
              overflow-hidden bg-muted sm:max-h-[calc(100vh-3rem)]"
          >
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
                  class="absolute inset-0 size-full bg-black object-contain"
                ></video>
              )}
            </Show>
            <Show when={roomStatus.profile}>
              {(info) => (
                <div class="absolute left-1 top-1">
                  <Badge
                    variant="secondary"
                    class="gap-1 bg-black/50 text-xs text-white hover:bg-black/80"
                  >
                    <span>{`${info().name} (You)`}</span>

                    <IconVolumeUpFilled
                      class={cn(
                        "size-4",
                        anySpeaking() ? "block" : "hidden",
                      )}
                    />
                  </Badge>
                </div>
              )}
            </Show>
            <LocalToolbar
              client={roomStatus.profile ?? undefined}
              class={cn(
                "absolute top-1 flex gap-1",
                isMobile()
                  ? "right-1"
                  : "left-1/2 -translate-x-1/2",
              )}
            />
          </div>
          <For
            each={Object.values(
              sessionService.clientInfo,
            ).filter(
              (client) => client.stream !== undefined,
            )}
          >
            {(client) => <VideoItem client={client} />}
          </For>
        </div>
      </Tabs>
    </>
  );
}

const LocalToolbar = (props: {
  client?: ClientInfo;
  class?: string;
}) => {
  const closeStream = async () => {
    setDisplayStream(null);
  };

  const {
    open: openMediaSelection,
    Component: MediaSelectionDialogComponent,
  } = createMediaSelectionDialog();

  const audioTrack = createMemo(() => {
    const stream = localStream();
    if (stream) {
      return stream.getAudioTracks().find((track) => {
        return track.kind === "audio";
      });
    }
    return null;
  });

  const [muted, setMuted] = createSignal(false);

  createEffect(() => {
    const track = audioTrack();
    if (track) {
      track.enabled = !muted();
    }
  });

  return (
    <div
      class={cn(
        "flex gap-1 rounded-full bg-black/50",
        props.class,
      )}
    >
      <MediaSelectionDialogComponent />
      <Button
        size="sm"
        onClick={async () => {
          const { result } = await openMediaSelection();
          if (result) {
            setDisplayStream(result);
          }
        }}
        variant={localStream() ? "secondary" : "default"}
        class="h-8 text-nowrap rounded-full p-2 hover:gap-1
          [&:hover>.grid]:grid-cols-[1fr]"
      >
        <IconScreenShare class="size-4" />
        <p class="grid grid-cols-[0fr] overflow-hidden transition-all">
          <span class="min-w-0">
            {localStream()
              ? t("common.action.change")
              : t("common.action.select")}
          </span>
        </p>
      </Button>

      <Show when={audioTrack()}>
        <Button
          size="sm"
          class="h-8 text-nowrap rounded-full p-2 hover:gap-1
            [&:hover>.grid]:grid-cols-[1fr]"
          variant={muted() ? "default" : "secondary"}
          onClick={() => {
            setMuted(!muted());
          }}
        >
          <Dynamic
            component={
              muted() ? IconVolumeOff : IconVolumeUp
            }
            class="size-4"
          />
          <p class="grid grid-cols-[0fr] overflow-hidden transition-all">
            <span class="min-w-0">
              {muted()
                ? t("common.action.unmute")
                : t("common.action.mute")}
            </span>
          </p>
        </Button>
      </Show>
      <Show when={localStream()}>
        <Button
          size="sm"
          onClick={() => closeStream()}
          variant="destructive"
          class="h-8 text-nowrap rounded-full p-2 hover:gap-1
            [&:hover>.grid]:grid-cols-[1fr]"
        >
          <IconStopScreenShare class="size-4" />
          <p class="grid grid-cols-[0fr] overflow-hidden transition-all">
            <span class="min-w-0">
              {t("common.action.close")}
            </span>
          </p>
        </Button>
      </Show>
    </div>
  );
};

const VideoItem = (props: { client: ClientInfo }) => {
  const remoteStream = createMemo(() => {
    return props.client.stream ?? null;
  });

  const [speaking, setSpeaking] = createStore<
    Array<[string, Accessor<boolean>]>
  >([]);

  createEffect(() => {
    const remoteTracks = remoteStream()
      ?.getAudioTracks()
      .map((track) => {
        return [
          track.contentHint,
          createCheckVolume(() => new MediaStream([track])),
        ] as [string, Accessor<boolean>];
      });
    setSpeaking(remoteTracks ?? []);
  });

  const anySpeaking = createMemo(() => {
    return speaking.some(([_, speak]) => speak());
  });

  return (
    <div
      class="relative aspect-video
        max-h-[calc(100vh-3rem-var(--mobile-header-height))] w-full
        overflow-hidden bg-muted sm:max-h-[calc(100vh-3rem)]"
    >
      <Show
        when={props.client.stream}
        fallback={
          <div class="absolute inset-0 content-center text-center">
            no stream
          </div>
        }
      >
        <video
          autoplay
          controls
          class="absolute inset-0 size-full bg-black object-contain"
          ref={(ref) => {
            createEffect(() => {
              if (remoteStream()) {
                ref.srcObject = remoteStream();
              }
            });
          }}
        />
        <div class="absolute left-1 top-1 flex gap-1">
          <Badge
            variant="secondary"
            class="gap-1 bg-black/50 text-xs text-white hover:bg-black/80"
          >
            {props.client.name}
            <IconVolumeUpFilled
              class={cn(
                "size-4",
                anySpeaking() ? "block" : "hidden",
              )}
            />
          </Badge>
        </div>
      </Show>
    </div>
  );
};
