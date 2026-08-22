"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { INITIAL_RECORDER_STATE, RecorderController, type RecorderState } from "./controller";

const getServerSnapshot = () => INITIAL_RECORDER_STATE;

/** React binding for RecorderController. Starts when `active` and a device id are available; stops on unmount. */
export function useRecorder(sessionId: string, deviceId: string | null, active: boolean) {
  const [controller, setController] = useState<RecorderController | null>(null);
  useEffect(() => {
    if (!active || !deviceId) return;
    const c = new RecorderController(sessionId, deviceId);
    const t = setTimeout(() => {
      setController(c);
      void c.start();
    }, 0);
    return () => {
      clearTimeout(t);
      c.stop();
      setController(null);
    };
  }, [sessionId, deviceId, active]);
  const state: RecorderState = useSyncExternalStore(
    controller?.subscribe ?? (() => () => undefined),
    controller?.getState ?? getServerSnapshot,
    getServerSnapshot,
  );
  return { state, flush: () => controller?.flush() ?? Promise.resolve() };
}
