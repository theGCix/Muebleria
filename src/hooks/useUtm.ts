// src/hooks/useUtm.ts
import { useEffect } from "react";

const UTM_KEY = "gm_utm";

export type UtmData = {
  utm_source?:   string;
  utm_medium?:   string;
  utm_campaign?: string;
  utm_content?:  string;
  referrer_url?: string;
};

export function useUtmCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data: UtmData = {};
    if (params.get("utm_source"))   data.utm_source   = params.get("utm_source")!;
    if (params.get("utm_medium"))   data.utm_medium   = params.get("utm_medium")!;
    if (params.get("utm_campaign")) data.utm_campaign = params.get("utm_campaign")!;
    if (params.get("utm_content"))  data.utm_content  = params.get("utm_content")!;
    if (document.referrer)          data.referrer_url = document.referrer;

    if (Object.keys(data).length > 0) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(data));
    }
  }, []);
}

export function getStoredUtm(): UtmData {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_KEY) ?? "{}");
  } catch {
    return {};
  }
}