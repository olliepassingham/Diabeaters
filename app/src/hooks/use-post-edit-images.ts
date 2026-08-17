import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { clickHiddenFileInput } from "@/lib/click-hidden-file-input";
import { filesFromImageInput, pickPostImagesFromLibrary } from "@/lib/community/pick-post-images";
import { getPostImageSignedUrls, MAX_POST_IMAGES } from "@/lib/community";

export type PostEditImagePreview = {
  key: string;
  previewUrl: string | null;
  label: string;
  isNew: boolean;
};

function normalizeAlts(raw: string[] | undefined, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(String(raw?.[i] ?? "").trim().slice(0, 500));
  }
  return out;
}

export function usePostEditImages() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [keptPaths, setKeptPaths] = useState<string[]>([]);
  const [existingPreviewUrls, setExistingPreviewUrls] = useState<(string | null)[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);
  const [imageAlts, setImageAlts] = useState<string[]>([]);

  const totalCount = keptPaths.length + newFiles.length;
  const canAddMore = totalCount < MAX_POST_IMAGES;

  const loadFromPost = useCallback((paths: string[], alts: string[]) => {
    setKeptPaths([...paths]);
    setNewFiles([]);
    setImageAlts(normalizeAlts(alts, paths.length));
    void (async () => {
      if (paths.length === 0) {
        setExistingPreviewUrls([]);
        return;
      }
      setExistingPreviewUrls(await getPostImageSignedUrls(paths));
    })();
  }, []);

  const reset = useCallback(() => {
    setKeptPaths([]);
    setExistingPreviewUrls([]);
    setNewFiles([]);
    setNewPreviewUrls([]);
    setImageAlts([]);
  }, []);

  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setNewPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newFiles]);

  useEffect(() => {
    const count = keptPaths.length + newFiles.length;
    setImageAlts((prev) => {
      if (prev.length === count) return prev;
      const next = prev.slice(0, count);
      while (next.length < count) next.push("");
      return next;
    });
  }, [keptPaths.length, newFiles.length]);

  const previews = useMemo((): PostEditImagePreview[] => {
    const items: PostEditImagePreview[] = [];
    keptPaths.forEach((path, i) => {
      items.push({
        key: `existing-${path}`,
        previewUrl: existingPreviewUrls[i] ?? null,
        label: `Photo ${i + 1}`,
        isNew: false,
      });
    });
    newFiles.forEach((file, i) => {
      items.push({
        key: `new-${file.name}-${i}`,
        previewUrl: newPreviewUrls[i] ?? null,
        label: file.name.trim() || `New photo ${i + 1}`,
        isNew: true,
      });
    });
    return items;
  }, [keptPaths, existingPreviewUrls, newFiles, newPreviewUrls]);

  const removeAt = useCallback((index: number) => {
    if (index < keptPaths.length) {
      setKeptPaths((prev) => prev.filter((_, i) => i !== index));
      setExistingPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      const ni = index - keptPaths.length;
      setNewFiles((prev) => prev.filter((_, i) => i !== ni));
    }
    setImageAlts((prev) => prev.filter((_, i) => i !== index));
  }, [keptPaths.length]);

  const appendFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setNewFiles((prev) => {
      const room = MAX_POST_IMAGES - keptPaths.length - prev.length;
      if (room <= 0) return prev;
      return [...prev, ...files.slice(0, room)];
    });
  }, [keptPaths.length]);

  const onPickFromInput = useCallback(
    (files: FileList | null) => {
      const picked = filesFromImageInput(files, totalCount);
      appendFiles(picked);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [appendFiles, totalCount],
  );

  const pickFromLibrary = useCallback(async () => {
    if (!canAddMore) return;
    try {
      const picked = await pickPostImagesFromLibrary(totalCount, fileInputRef.current);
      if (picked.length > 0) {
        appendFiles(picked);
        return;
      }
    } catch (e) {
      if (!Capacitor.isNativePlatform()) return;
      toast({
        title: "Could not open Photos",
        description: e instanceof Error ? e.message : "Try selecting from your camera roll.",
        variant: "destructive",
      });
      clickHiddenFileInput(fileInputRef.current);
    }
  }, [appendFiles, canAddMore, toast, totalCount]);

  const setAltAt = useCallback((index: number, value: string) => {
    setImageAlts((prev) => {
      const next = [...prev];
      next[index] = value.slice(0, 500);
      return next;
    });
  }, []);

  const hasBodyOrImages = useCallback(
    (body: string) => Boolean(body.trim()) || totalCount > 0,
    [totalCount],
  );

  return {
    fileInputRef,
    keptPaths,
    newFiles,
    imageAlts,
    previews,
    totalCount,
    canAddMore,
    loadFromPost,
    reset,
    removeAt,
    onPickFromInput,
    pickFromLibrary,
    setAltAt,
    hasBodyOrImages,
  };
}
