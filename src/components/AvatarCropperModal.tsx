"use client";

import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

interface AvatarCropperModalProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => Promise<void> | void;
  isSaving?: boolean;
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputSize: number = 500
): Promise<File> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = (err) => reject(err);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not create 2D canvas context");
  }

  canvas.width = outputSize;
  canvas.height = outputSize;

  // Use high quality interpolation for clean scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas blob generation failed"));
          return;
        }
        const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        resolve(file);
      },
      "image/jpeg",
      0.92
    );
  });
}

export default function AvatarCropperModal({
  imageSrc,
  onCancel,
  onConfirm,
  isSaving = false,
}: AvatarCropperModalProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropCompleteHandler = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      await onConfirm(croppedFile);
    } catch (err) {
      console.error("Error cropping image:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-[#131313] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-serif text-lg font-bold text-on-surface">
              Adjust Profile Picture
            </h3>
            <p className="text-xs text-on-surface-variant/70">
              Drag image to reposition • Use slider to zoom
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="text-on-surface-variant hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-72 sm:h-80 md:h-96 bg-[#050505]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteHandler}
          />
        </div>

        {/* Zoom Controls */}
        <div className="px-6 py-4 bg-[#181818] border-t border-white/5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
            disabled={isSaving || zoom <= 1}
            className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30 cursor-pointer p-1"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-xl">zoom_out</span>
          </button>
          
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            disabled={isSaving}
            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
            aria-label="Zoom level"
          />

          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
            disabled={isSaving || zoom >= 3}
            className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30 cursor-pointer p-1"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-xl">zoom_in</span>
          </button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-[#131313]">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-full border border-white/20 text-on-surface hover:bg-white/5 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !croppedAreaPixels}
            className="bg-primary text-black hover:opacity-90 font-bold text-sm px-6 py-2.5 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(255,180,170,0.2)] disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Saving Avatar...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">check</span>
                <span>Save Avatar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
