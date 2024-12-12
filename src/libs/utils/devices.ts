import {
  createMemo,
  createResource,
  createRoot,
  onCleanup,
  onMount,
} from "solid-js";

const [mediaDevices, { refetch: refetchDevices }] =
  createResource(
    () => navigator.mediaDevices.enumerateDevices(),
    {
      initialValue: [],
    },
  );

export const createCameras = () => {
  const cameras = createMemo(() =>
    mediaDevices().filter(
      (device) => device.kind === "videoinput",
    ),
  );

  return cameras;
};

export const createMicrophones = () => {
  const microphones = createMemo(() =>
    mediaDevices().filter(
      (device) => device.kind === "audioinput",
    ),
  );

  return microphones;
};

export const createSpeakers = () => {
  const speakers = createMemo(() =>
    mediaDevices().filter(
      (device) => device.kind === "audiooutput",
    ),
  );

  return speakers;
};

createRoot(() => {
  onMount(() => {
    navigator.mediaDevices.addEventListener(
      "devicechange",
      refetchDevices,
    );

    onCleanup(() => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        refetchDevices,
      );
    });
  });
});

export { refetchDevices };
