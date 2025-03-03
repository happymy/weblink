import {
  clientProfile,
  getDefaultProfile,
  setClientProfile,
} from "@/libs/core/store";
import { createDialog } from "./dialogs/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { optional } from "@/libs/core/utils/optional";
import { useWebRTC } from "@/libs/core/rtc-context";
import {
  Component,
  ComponentProps,
  createMemo,
  onMount,
  Show,
} from "solid-js";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./ui/avatar";
import {
  Switch,
  SwitchControl,
  SwitchLabel,
  SwitchThumb,
} from "./ui/switch";
import { IconCasino, IconLogin, IconLogout } from "./icons";
import { toast } from "solid-sonner";
import { t } from "@/i18n";
import { sessionService } from "@/libs/services/session-service";
import { appOptions } from "@/options";
import { getInitials } from "@/libs/utils/name";
import { generateStrongPassword } from "@/libs/core/utils/encrypt/strong-password";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

export const createRoomDialog = () => {
  const { open, close, submit, Component } = createDialog({
    title: () => t("common.join_form.title"),
    description: () => t("common.join_form.description"),
    content: () => (
      <>
        <form
          id="join-room"
          class="grid gap-4 overflow-y-auto p-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            setClientProfile("firstTime", false);
            submit(clientProfile);
          }}
        >
          <label class="flex flex-col gap-2">
            <span class="input-label">
              {t("common.join_form.client_id.title")}
            </span>

            <Input
              required
              readonly
              value={clientProfile.clientId}
              readOnly={true}
            />

            <p class="muted">
              {t("common.join_form.client_id.description")}
            </p>
          </label>
          <label class="flex flex-col gap-2">
            <span class="input-label">
              {t("common.join_form.room_id.title")}
            </span>
            <Input
              required
              value={clientProfile.roomId}
              onInput={(ev) =>
                setClientProfile(
                  "roomId",
                  ev.currentTarget.value,
                )
              }
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="input-label">
              {t("common.join_form.name")}
            </span>
            <Input
              required
              value={clientProfile.name}
              onInput={(ev) =>
                setClientProfile(
                  "name",
                  ev.currentTarget.value,
                )
              }
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="input-label">
              {t("common.join_form.avatar_url")}
            </span>
            <Input
              placeholder="Enter a link or upload an image"
              type="url"
              value={clientProfile.avatar ?? ""}
              onInput={(ev) =>
                setClientProfile(
                  "avatar",
                  optional(ev.currentTarget.value),
                )
              }
            />
            <div class="flex items-center gap-2">
              <Input
                type="file"
                multiple={false}
                accept="image/*"
                onChange={async (ev) => {
                  const file =
                    ev.currentTarget.files?.item(0);
                  if (!file) return;

                  const url =
                    await imageFileToFilledSquareAvatar(
                      file,
                      128,
                    );
                  setClientProfile("avatar", url);
                }}
              />
              <Avatar>
                <AvatarImage
                  src={clientProfile.avatar ?? undefined}
                />
                <AvatarFallback>
                  {getInitials(clientProfile.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </label>
          <label class="flex flex-col gap-2">
            <span class="input-label">
              {t("common.join_form.password.title")}
            </span>
            <div class="flex gap-1">
              <Input
                placeholder={t(
                  "common.join_form.password.placeholder",
                )}
                value={clientProfile.password ?? ""}
                onInput={(ev) =>
                  setClientProfile(
                    "password",
                    optional(ev.currentTarget.value),
                  )
                }
              />
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  const password =
                    await generateStrongPassword();
                  setClientProfile("password", password);
                }}
              >
                <IconCasino class="size-6" />
              </Button>
            </div>
            <p class="muted">
              {t("common.join_form.password.description")}
            </p>
          </label>
          <Switch
            class="flex items-center justify-between"
            checked={clientProfile.autoJoin}
            onChange={(isChecked) =>
              setClientProfile("autoJoin", isChecked)
            }
          >
            <SwitchLabel>
              {t("common.join_form.auto_join")}
            </SwitchLabel>
            <SwitchControl>
              <SwitchThumb />
            </SwitchControl>
          </Switch>
        </form>
      </>
    ),
    confirm: (
      <Button type="submit" form="join-room">
        {t("common.action.confirm")}
      </Button>
    ),
    cancel: (
      <Button variant="destructive" onClick={() => close()}>
        {t("common.action.cancel")}
      </Button>
    ),
  });
  return { open, Component };
};

export const joinUrl = createMemo(() => {
  const url = new URL(location.origin);
  url.searchParams.append("id", clientProfile.roomId);
  if (clientProfile.password)
    url.searchParams.append("pwd", clientProfile.password);

  if (appOptions.shareServersWithOthers) {
    if (appOptions.servers.stuns.length > 0) {
      url.searchParams.append(
        "stun",
        JSON.stringify(appOptions.servers.stuns),
      );
    }
    if (
      appOptions.servers.turns &&
      appOptions.servers.turns.length > 0
    ) {
      url.searchParams.append(
        "turn",
        JSON.stringify(appOptions.servers.turns),
      );
    }
  }
  url.searchParams.append("join", "true");
  return url.toString();
});

export function JoinRoomButton(
  props: ComponentProps<"button">,
) {
  const { joinRoom, roomStatus, leaveRoom } = useWebRTC();
  const { open, Component } = createRoomDialog();

  return (
    <>
      <Component />
      <Show
        when={
          sessionService.clientServiceStatus() ===
          "disconnected"
        }
        fallback={
          <Tooltip>
            <TooltipTrigger
              as={Button}
              disabled={
                sessionService.clientServiceStatus() !==
                "connected"
              }
              onClick={() => leaveRoom()}
              variant="destructive"
              size="icon"
            >
              <IconLogout class="size-6" />
            </TooltipTrigger>
            <TooltipContent>
              {t("common.nav.leave_room")}
            </TooltipContent>
          </Tooltip>
        }
      >
        <Tooltip>
          <TooltipTrigger
            as={Button}
            size="icon"
            disabled={
              sessionService.clientServiceStatus() !==
              "disconnected"
            }
            onClick={async () => {
              const result = await open();
              if (result.cancel) return;

              await joinRoom().catch((err) => {
                console.error(err);
                toast.error(err.message);
              });
            }}
            {...props}
          >
            <IconLogin class="size-6" />
          </TooltipTrigger>
          <TooltipContent>
            {t("common.nav.join_room")}
          </TooltipContent>
        </Tooltip>
      </Show>
    </>
  );
}

/**
 * 将图片文件转换为填充整个正方形头像的 dataURL
 * @param file - 用户上传的图片文件
 * @param size - 目标头像尺寸（正方形大小）
 * @returns Promise<string> 返回裁剪并填充后的图片的 dataURL
 */
function imageFileToFilledSquareAvatar(
  file: File,
  size: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("请上传一个有效的图片文件"));
    }

    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(
            new Error("无法获取 Canvas 上下文"),
          );
        }

        // 设置目标尺寸为正方形
        canvas.width = size;
        canvas.height = size;

        // 计算缩放比例，以保证图片能完全覆盖整个正方形区域
        const imgAspectRatio = img.width / img.height;
        const canvasAspectRatio = 1; // 因为 canvas 是正方形
        let sx = 0,
          sy = 0,
          sWidth = img.width,
          sHeight = img.height;

        if (imgAspectRatio > canvasAspectRatio) {
          // 图片宽比高长，以高度为基准裁剪
          sWidth = img.height * canvasAspectRatio;
          sx = (img.width - sWidth) / 2; // 水平居中裁剪
        } else {
          // 图片高比宽长，以宽度为基准裁剪
          sHeight = img.width / canvasAspectRatio;
          sy = (img.height - sHeight) / 2; // 垂直居中裁剪
        }

        // 在 canvas 上绘制裁剪并缩放后的图片
        ctx.drawImage(
          img,
          sx,
          sy,
          sWidth,
          sHeight,
          0,
          0,
          size,
          size,
        );

        // 将 canvas 转换为 dataURL
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      };

      img.onerror = () => {
        reject(new Error("加载图片失败"));
      };
    };

    reader.onerror = () => {
      reject(new Error("读取图片文件失败"));
    };

    // 开始读取文件
    reader.readAsDataURL(file);
  });
}
