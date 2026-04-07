/**
 * React context: one emergency profile shared across Account, Settings, Help now, dashboard widgets, etc.
 * Writes go to localStorage immediately; Supabase `profiles` is updated on a short debounce and on `saveNow()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { getProfile, upsertProfile } from "@/lib/profile";
import { getSupabase } from "@/lib/supabase";
import {
  buildEmergencyNotesBlob,
  EMPTY_EMERGENCY_PROFILE,
  getEmergencyProfileStorageKey,
  mergeProfileRowIntoLocal,
  readLocalEmergencyProfile,
  writeLocalEmergencyProfile,
  type EmergencyProfileData,
} from "@/lib/emergency-sync";

const CLOUD_DEBOUNCE_MS = 550;

type EmergencyProfileContextValue = {
  data: EmergencyProfileData;
  isLoading: boolean;
  /** Incremented when data is merged from cloud or another tab — use for subtle UI motion. */
  syncGeneration: number;
  /** Field keys last filled from Supabase (cleared when the user edits that field). */
  isFieldPrefilled: (key: keyof EmergencyProfileData) => boolean;
  updateField: <K extends keyof EmergencyProfileData>(key: K, value: EmergencyProfileData[K]) => void;
  /** Flush debounced cloud write (e.g. form submit). */
  saveNow: () => Promise<void>;
};

const EmergencyProfileContext = createContext<EmergencyProfileContextValue | null>(null);

export function EmergencyProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<EmergencyProfileData>(() => readLocalEmergencyProfile());
  const [isLoading, setIsLoading] = useState(false);
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [prefilledKeys, setPrefilledKeys] = useState<Set<string>>(() => new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCloudRef = useRef<EmergencyProfileData | null>(null);

  const flushCloud = useCallback(async (payload: EmergencyProfileData) => {
    const supabase = getSupabase();
    if (!supabase || !user?.id) return;
    const notesBlob = buildEmergencyNotesBlob(payload);
    const { error } = await upsertProfile({
      id: user.id,
      emergency_contact_name: payload.contactName.trim() || null,
      emergency_contact_phone: payload.phone.trim() || null,
      emergency_notes: notesBlob.trim() ? notesBlob : null,
    });
    if (error) throw error;
  }, [user?.id]);

  const scheduleCloudWrite = useCallback(
    (payload: EmergencyProfileData) => {
      pendingCloudRef.current = payload;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        const p = pendingCloudRef.current;
        if (p) void flushCloud(p);
      }, CLOUD_DEBOUNCE_MS);
    },
    [flushCloud],
  );

  // Hydrate from Supabase when the signed-in user changes.
  useEffect(() => {
    if (!user?.id) {
      setData(readLocalEmergencyProfile());
      setPrefilledKeys(new Set());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const local = readLocalEmergencyProfile();
      const { profile } = await getProfile(user.id);
      if (cancelled) return;

      if (
        profile &&
        (profile.emergency_contact_name || profile.emergency_contact_phone || profile.emergency_notes)
      ) {
        const { merged, prefilledKeys: pf } = mergeProfileRowIntoLocal(profile, local);
        writeLocalEmergencyProfile(merged);
        setData(merged);
        setPrefilledKeys(pf);
        setSyncGeneration((g) => g + 1);
      } else {
        setData(local);
        setPrefilledKeys(new Set());
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Other tabs / windows updating the same localStorage key.
  useEffect(() => {
    const key = getEmergencyProfileStorageKey();
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue == null) return;
      try {
        const next = JSON.parse(e.newValue) as EmergencyProfileData;
        setData(next);
        setSyncGeneration((g) => g + 1);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateField = useCallback(
    <K extends keyof EmergencyProfileData>(key: K, value: EmergencyProfileData[K]) => {
      setData((prev) => {
        const next: EmergencyProfileData = {
          ...prev,
          [key]: value,
          updatedAt: Date.now(),
        };
        writeLocalEmergencyProfile(next);
        setPrefilledKeys((pk) => {
          if (!pk.has(key as string)) return pk;
          const n = new Set(pk);
          n.delete(key as string);
          return n;
        });
        scheduleCloudWrite(next);
        // Do not bump syncGeneration here: EmergencyProfileFields uses it as `key` and remounting
        // on every keystroke breaks phone/text inputs (one character at a time).
        return next;
      });
    },
    [scheduleCloudWrite],
  );

  const saveNow = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const latest = readLocalEmergencyProfile();
    await flushCloud(latest);
  }, [flushCloud]);

  const isFieldPrefilled = useCallback(
    (key: keyof EmergencyProfileData) => prefilledKeys.has(key as string),
    [prefilledKeys],
  );

  const value = useMemo<EmergencyProfileContextValue>(
    () => ({
      data,
      isLoading,
      syncGeneration,
      isFieldPrefilled,
      updateField,
      saveNow,
    }),
    [data, isFieldPrefilled, isLoading, saveNow, syncGeneration, updateField],
  );

  return <EmergencyProfileContext.Provider value={value}>{children}</EmergencyProfileContext.Provider>;
}

export function useEmergencyProfile(): EmergencyProfileContextValue {
  const ctx = useContext(EmergencyProfileContext);
  if (!ctx) {
    throw new Error("useEmergencyProfile must be used within EmergencyProfileProvider");
  }
  return ctx;
}

export type { EmergencyProfileData };
export { EMPTY_EMERGENCY_PROFILE };
