import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Ref,
  Show,
  untrack,
} from "solid-js";
import { useWebRTC } from "@/libs/core/rtc-context";
import { Button } from "@/components/ui/button";
import {
  localStream,
  setDisplayStream,
} from "@/libs/stream";
import { sessionService } from "@/libs/services/session-service";
import { t } from "@/i18n";
import {
  IconCropSquare,
  IconDelete,
  IconFullscreen,
  IconMeetingRoom,
  IconMic,
  IconMicOff,
  IconPip,
  IconPipExit,
  IconResetWrench,
  IconScreenShare,
  IconSettings,
  IconStopScreenShare,
  IconVideoCam,
  IconVideoCamOff,
  IconViewCompactAlt,
  IconVolumeOff,
  IconVolumeUp,
  IconWindow,
} from "@/components/icons";
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
import { createMediaSelectionDialog } from "@/components/media-selection-dialog";
import { clientProfile } from "@/libs/core/store";
import { createApplyConstraintsDialog } from "@/components/track-constaints";
import { useAudioPlayer } from "@/components/audio-player";
import {
  useVideoDisplay,
  VideoDisplay,
} from "@/components/video-display";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createMediaTracks } from "@/libs/hooks/tracks";
import { createPictureInPicture } from "@/libs/hooks/picture-in-picture";
import { createFullscreen } from "@/libs/hooks/fullscreen";
import { FlexButton } from "./components/flex-button";
import {
  GridItem,
  GridItemContent,
  GridStack,
  GridStackRef,
  layout,
  setLayout,
} from "@/libs/gridstack";
import { createElementSize } from "@solid-primitives/resize-observer";
import {
  GridStackOptions,
  numberOrString,
} from "gridstack";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { getInitials } from "@/libs/utils/name";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const [removedClientIds, setRemovedClientIds] =
  createSignal<string[]>([]);

export default function Video() {
  const { roomStatus } = useWebRTC();

  const isMobile = createIsMobile();

  const [tab, setTab] = createSignal(
    isMobile() ? "1" : "2",
  );

  createEffect(() => {
    setTab(isMobile() ? "1" : "2");
  });

  const { setPlay, playState, hasAudio } = useAudioPlayer();

  const [gridRef, setGridRef] =
    createSignal<GridStackRef>();

  const gridSize = createElementSize(gridRef);

  const gridCellHeight = createMemo<numberOrString>(() => {
    if (!gridSize.width) return "128px";
    const columns = isMobile() ? 6 : 12;
    return `${(gridSize.width / columns) * (9 / 16)}px`;
  });

  const gridColumn = createMemo<number>(() => {
    return isMobile() ? 1 : 12;
  });

  const gridOptions = createMemo(
    () =>
      ({
        cellHeight: gridCellHeight(),
        column: gridColumn(),
        animate: true,
        minRow: 1,
        resizable: {
          handles: "all",
        },
        acceptWidgets: true,
        removable: "[data-gs-removal-zone]",
      }) satisfies GridStackOptions,
  );

  createEffect(() => {
    const availableClientIds = Object.values(
      sessionService.clientViewData,
    ).map((client) => client.clientId);
    const newRemovedClientIds = untrack(
      removedClientIds,
    ).filter((removedClientId) =>
      availableClientIds.includes(removedClientId),
    );
    setRemovedClientIds(newRemovedClientIds);
  });

  const [dragging, setDragging] = createSignal(false);

  onMount(() => {
    document.scrollingElement?.classList.add(
      "scrollbar-none",
    );
    onCleanup(() => {
      document.scrollingElement?.classList.remove(
        "scrollbar-none",
      );
    });
  });

  return (
    <>
      <div
        class={cn(
          "fixed bottom-8 left-1/2 size-28 -translate-x-1/2",
          "rounded-xl border-2 border-dashed border-destructive",
          "bg-destructive/10 transition-all hover:border-destructive/80",
          `visible touch-manipulation opacity-100
          hover:bg-destructive/20`,
          !dragging() &&
            "invisible scale-[0.95] cursor-move opacity-0",
        )}
        data-gs-removal-zone
      >
        <div class="flex h-full items-center justify-center text-destructive">
          <IconDelete class="size-8" />
        </div>
      </div>
      <Tabs
        value={tab()}
        onChange={(value) => setTab(value)}
        class="flex size-full flex-col"
        defaultValue="2"
      >
        <div
          class="sticky top-[var(--mobile-header-height)] z-10 flex h-12
            w-full items-center gap-2 border-b border-border
            bg-background/80 px-4 backdrop-blur sm:top-0"
        >
          <h4 class="h4">
            {roomStatus.roomId ? (
              <p class="space-x-1 [&>*]:align-middle [&>svg]:inline">
                <IconMeetingRoom class="inline size-6" />
                <span>{roomStatus.roomId}</span>
              </p>
            ) : (
              t("video.title")
            )}
          </h4>
          <div class="flex-1"></div>
          <Show when={removedClientIds().length > 0}>
            <Popover>
              <PopoverTrigger
                as={Button}
                size="icon"
                class="size-8"
                variant="secondary"
              >
                <IconDelete class="size-4" />
              </PopoverTrigger>
              <PopoverContent class="flex flex-col gap-2">
                <h4 class="h4">
                  {t("common.action.restore")}
                </h4>
                <div class="grid grid-cols-4 gap-2">
                  <For each={removedClientIds()}>
                    {(clientId) => (
                      <Show
                        when={
                          sessionService.clientViewData[
                            clientId
                          ]
                        }
                      >
                        {(client) => (
                          <Avatar
                            class="size-10 cursor-pointer self-center"
                            onClick={() => {
                              setRemovedClientIds((prev) =>
                                prev.filter(
                                  (id) => id !== clientId,
                                ),
                              );
                            }}
                          >
                            <AvatarImage
                              src={
                                client().avatar ?? undefined
                              }
                            />
                            <AvatarFallback>
                              {getInitials(client().name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </Show>
                    )}
                  </For>
                </div>
              </PopoverContent>
            </Popover>
          </Show>
          <Show when={gridRef()}>
            {(gridRef) => (
              <>
                <Tooltip>
                  <TooltipTrigger
                    as={Button}
                    size="icon"
                    class="size-8"
                    variant="secondary"
                    onClick={() => gridRef().compact()}
                  >
                    <IconViewCompactAlt class="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("common.action.compact_layout")}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    as={Button}
                    size="icon"
                    class="size-8"
                    variant="secondary"
                    onClick={() => gridRef().resetLayout()}
                  >
                    <IconResetWrench class="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("common.action.reset_layout")}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </Show>
          <Show when={hasAudio()}>
            <Tooltip>
              <TooltipTrigger
                as={Button}
                onClick={() => setPlay(!playState())}
                size="icon"
                class="size-8"
                variant={
                  playState() ? "secondary" : "default"
                }
              >
                <Dynamic
                  component={
                    playState()
                      ? IconVolumeUp
                      : IconVolumeOff
                  }
                  class="size-4"
                />
              </TooltipTrigger>
              <TooltipContent>
                {playState()
                  ? t("common.action.global_mute")
                  : t("common.action.global_unmute")}
              </TooltipContent>
            </Tooltip>
          </Show>
        </div>

        <GridStack
          ref={setGridRef}
          options={gridOptions()}
          onDragStatusChange={(event, item, drag) => {
            setDragging(drag);
          }}
          onRemove={(event, items) => {
            items.forEach((item) => {
              const clientId = item.el?.id;
              if (clientId) {
                setLayout((prev) => {
                  const newLayout = { ...prev };
                  delete newLayout[clientId];
                  return newLayout;
                });
                setRemovedClientIds((prev) => [
                  ...prev,
                  clientId,
                ]);
              }
            });
          }}
        >
          <GridItem
            w={layout()?.[clientProfile.clientId]?.w ?? 6}
            h={layout()?.[clientProfile.clientId]?.h ?? 6}
            x={layout()?.[clientProfile.clientId]?.x}
            y={layout()?.[clientProfile.clientId]?.y}
            id={clientProfile.clientId}
            noRemovable
          >
            <GridItemContent class="relative rounded-lg bg-muted shadow-lg">
              <VideoDisplay
                class="absolute inset-0
                  max-h-[calc(100vh-3rem-var(--mobile-header-height))] w-full
                  sm:max-h-[calc(100vh-4rem)]"
                stream={localStream()}
                name={`${clientProfile.name} (You)`}
                avatar={clientProfile.avatar ?? undefined}
                muted={true}
              >
                <LocalToolbar
                  client={roomStatus.profile ?? undefined}
                  class={cn(
                    "absolute top-1 flex gap-1",
                    isMobile()
                      ? "right-1"
                      : "left-1/2 -translate-x-1/2",
                  )}
                />
              </VideoDisplay>
            </GridItemContent>
          </GridItem>
          <For
            each={Object.values(
              sessionService.clientViewData,
            )
              .filter(
                (client) => client.stream !== undefined,
              )
              .filter(
                (client) =>
                  !removedClientIds().includes(
                    client.clientId,
                  ),
              )}
          >
            {(client) => (
              <GridItem
                w={layout()?.[client.clientId]?.w ?? 6}
                h={layout()?.[client.clientId]?.h ?? 6}
                x={layout()?.[client.clientId]?.x}
                y={layout()?.[client.clientId]?.y}
                id={client.clientId}
              >
                <GridItemContent class="relative rounded-lg bg-muted shadow-lg">
                  <VideoDisplay
                    class="absolute inset-0
                      max-h-[calc(100vh-3rem-var(--mobile-header-height))] w-full
                      sm:max-h-[calc(100vh-4rem)]"
                    stream={client.stream}
                    name={client.name}
                    avatar={client.avatar ?? undefined}
                    muted={true}
                  >
                    <RemoteToolbar
                      class={cn(
                        "absolute top-1 flex gap-1",
                        isMobile()
                          ? "right-1"
                          : "left-1/2 -translate-x-1/2",
                      )}
                      client={client}
                    />
                  </VideoDisplay>
                </GridItemContent>
              </GridItem>
            )}
          </For>
        </GridStack>
      </Tabs>
    </>
  );
}

const RemoteToolbar = (props: {
  client?: ClientInfo;
  class?: string;
}) => {
  const { videoRef, audioTracks } = useVideoDisplay();

  const [muted, setMuted] = createSignal(false);

  const {
    isInPip,
    isThisElementInPip,
    isSupported: isPipSupported,
    requestPictureInPicture,
    exitPictureInPicture,
  } = createPictureInPicture(videoRef);

  createEffect(() => {
    audioTracks().forEach((track) => {
      track.enabled = !muted();
    });
  });

  const {
    isSupported: isFullscreenSupported,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
    isThisElementFullscreen,
  } = createFullscreen(videoRef);

  return (
    <div
      class={cn(
        "flex gap-1 rounded-full bg-black/50",
        props.class,
      )}
    >
      <Show when={audioTracks().length > 0}>
        <FlexButton
          size="sm"
          variant={muted() ? "default" : "secondary"}
          onClick={() => setMuted(!muted())}
          icon={
            <Dynamic
              component={
                muted() ? IconVolumeOff : IconVolumeUp
              }
              class="size-4"
            />
          }
        >
          {muted()
            ? t("common.action.unmute")
            : t("common.action.mute")}
        </FlexButton>
      </Show>
      <Show when={videoRef()}>
        {(ref) => (
          <>
            <Show when={isFullscreenSupported()}>
              <FlexButton
                icon={<IconFullscreen class="size-4" />}
                onClick={() => {
                  if (isThisElementFullscreen()) {
                    exitFullscreen();
                  } else {
                    requestFullscreen();
                  }
                }}
                variant={
                  isThisElementFullscreen()
                    ? "default"
                    : "secondary"
                }
              >
                {isThisElementFullscreen()
                  ? t("common.action.exit_fullscreen")
                  : isFullscreen()
                    ? t("common.action.switch_fullscreen")
                    : t("common.action.fullscreen")}
              </FlexButton>
            </Show>
            <Show when={isPipSupported()}>
              <FlexButton
                icon={
                  <Dynamic
                    component={
                      isInPip() ? IconPipExit : IconPip
                    }
                    class="size-4"
                  />
                }
                onClick={() => {
                  if (isThisElementInPip()) {
                    exitPictureInPicture();
                  } else {
                    requestPictureInPicture();
                  }
                }}
                variant={
                  isThisElementInPip()
                    ? "default"
                    : "secondary"
                }
              >
                {isThisElementInPip()
                  ? t(
                      "common.action.exit_picture_in_picture",
                    )
                  : isInPip()
                    ? t(
                        "common.action.switch_picture_in_picture",
                      )
                    : t("common.action.picture_in_picture")}
              </FlexButton>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
};

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

  const {
    open: openApplyConstraintsDialog,
    Component: ApplyConstraintsDialogComponent,
  } = createApplyConstraintsDialog();

  const tracks = createMediaTracks(
    () => localStream() ?? null,
  );

  const audioTracks = createMemo(() =>
    tracks().filter((track) => track.kind === "audio"),
  );

  const videoTrack = createMemo(() =>
    tracks().find((track) => track.kind === "video"),
  );

  const microphoneAudioTrack = createMemo(() => {
    return (
      audioTracks()?.find((track) => {
        return track.contentHint === "speech";
      }) ?? null
    );
  });

  const speakerAudioTrack = createMemo(() => {
    return (
      audioTracks()?.find((track) => {
        return track.contentHint === "music";
      }) ?? null
    );
  });

  const [microphoneMuted, setMicrophoneMuted] =
    createSignal(false);
  createEffect(() => {
    const track = microphoneAudioTrack();
    if (track) {
      track.enabled = !microphoneMuted();
    }
  });

  const [speakerMuted, setSpeakerMuted] =
    createSignal(false);
  createEffect(() => {
    const track = speakerAudioTrack();
    if (track) {
      track.enabled = !speakerMuted();
    }
  });

  const [videoStop, setVideoStop] = createSignal(false);
  createEffect(() => {
    const track = videoTrack();
    if (track) {
      track.enabled = !videoStop();
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
      <ApplyConstraintsDialogComponent />
      <FlexButton
        size="sm"
        onClick={async () => {
          const { result } = await openMediaSelection();
          if (result) {
            setDisplayStream(result);
          }
        }}
        icon={<IconScreenShare class="size-4" />}
        variant={localStream() ? "secondary" : "default"}
      >
        {localStream()
          ? t("common.action.change")
          : t("common.action.select")}
      </FlexButton>
      <Show when={speakerAudioTrack()}>
        <FlexButton
          size="sm"
          variant={speakerMuted() ? "default" : "secondary"}
          onClick={() => {
            setSpeakerMuted(!speakerMuted());
          }}
          icon={
            <Dynamic
              component={
                speakerMuted()
                  ? IconVolumeOff
                  : IconVolumeUp
              }
              class="size-4"
            />
          }
        >
          {speakerMuted()
            ? t("common.action.unmute")
            : t("common.action.mute")}
        </FlexButton>
      </Show>
      <Show when={microphoneAudioTrack()}>
        <FlexButton
          size="sm"
          variant={
            microphoneMuted() ? "default" : "secondary"
          }
          onClick={() => {
            setMicrophoneMuted(!microphoneMuted());
          }}
          icon={
            <Dynamic
              component={
                microphoneMuted() ? IconMicOff : IconMic
              }
              class="size-4"
            />
          }
        >
          {microphoneMuted()
            ? t("common.action.unmute")
            : t("common.action.mute")}
        </FlexButton>
      </Show>
      <Show when={videoTrack()}>
        <FlexButton
          size="sm"
          onClick={() => setVideoStop(!videoStop())}
          variant={videoStop() ? "default" : "secondary"}
          icon={
            <Dynamic
              component={
                videoStop() ? IconVideoCamOff : IconVideoCam
              }
              class="size-4"
            />
          }
        >
          {videoStop()
            ? t("common.action.continue")
            : t("common.action.pause")}
        </FlexButton>
      </Show>
      <Show when={audioTracks().length > 0 || videoTrack()}>
        <FlexButton
          size="sm"
          onClick={() => {
            const stream = localStream();
            if (stream) {
              openApplyConstraintsDialog(stream);
            }
          }}
          variant="secondary"
          icon={<IconSettings class="size-4" />}
        >
          {t("common.action.settings")}
        </FlexButton>
      </Show>
      <Show when={localStream()}>
        <FlexButton
          size="sm"
          onClick={() => closeStream()}
          variant="destructive"
          icon={<IconStopScreenShare class="size-4" />}
        >
          {t("common.action.close")}
        </FlexButton>
      </Show>
    </div>
  );
};
