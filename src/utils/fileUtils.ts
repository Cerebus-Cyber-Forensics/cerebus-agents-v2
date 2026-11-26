import { ProcessedProfilePhoto, ProcessedUploadFile } from '../types';

const MAX_ENCODED_DATA_URL_CHARS = 850000;
const MAX_THUMB_DATA_URL_CHARS = 75000;
const MAX_IMAGE_WIDTH = 1400;

export async function processUploadFile(
  file: File,
): Promise<ProcessedUploadFile> {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';

  if (!isImage && !isPdf) {
    throw new Error('Only PDF, PNG, JPG, or WebP files are supported.');
  }

  if (isImage) {
    const compressed = await compressImageToDataUrl(file);
    if (compressed.dataUrl.length > MAX_ENCODED_DATA_URL_CHARS) {
      throw new Error(
        `Image "${file.name}" exceeds size limits after compression. Please use a smaller scan.`,
      );
    }
    return compressed;
  }

  if (file.size > 580000) {
    throw new Error(
      `PDF "${file.name}" is ${(file.size / 1024).toFixed(0)} KB. Please upload a PDF under 580 KB.`,
    );
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length > MAX_ENCODED_DATA_URL_CHARS) {
    throw new Error(`PDF "${file.name}" is too large to store inline.`);
  }

  return {
    fileName: file.name.slice(0, 200),
    mimeType: file.type || 'application/pdf',
    fileSize: file.size,
    dataUrl,
  };
}

export async function processProfilePhotoFile(
  file: File,
): Promise<ProcessedProfilePhoto> {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      'Agent face picture must be an image file (PNG, JPG, or WebP).',
    );
  }

  const compressed = await compressImageToDataUrl(file);
  if (compressed.dataUrl.length > MAX_ENCODED_DATA_URL_CHARS) {
    throw new Error(
      `Photo "${file.name}" exceeds size limits after compression. Please use a smaller image.`,
    );
  }

  const thumbDataUrl = await createSquareFaceThumbnail(compressed.dataUrl);
  return {
    ...compressed,
    thumbDataUrl,
  };
}

function createSquareFaceThumbnail(sourceDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 240;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable for thumbnail generation.'));
        return;
      }

      const side = Math.min(img.width, img.height);
      const sx = Math.max(0, Math.round((img.width - side) / 2));
      const sy = Math.max(0, Math.round((img.height - side) / 4));

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

      let quality = 0.78;
      let thumb = canvas.toDataURL('image/jpeg', quality);
      while (thumb.length > MAX_THUMB_DATA_URL_CHARS && quality > 0.3) {
        quality -= 0.12;
        thumb = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(thumb.slice(0, MAX_THUMB_DATA_URL_CHARS));
    };
    img.onerror = () =>
      reject(new Error('Could not generate thumbnail for selected image.'));
    img.src = sourceDataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected file.'));
    reader.readAsDataURL(file);
  });
}

async function compressImageToDataUrl(
  file: File,
): Promise<ProcessedUploadFile> {
  const rawUrl = await readFileAsDataUrl(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_WIDTH / Math.max(1, img.width));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable for image processing.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.78;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > 500000 && quality > 0.35) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      resolve({
        fileName: file.name.slice(0, 200),
        mimeType: 'image/jpeg',
        fileSize: Math.round((dataUrl.length * 3) / 4),
        dataUrl,
      });
    };
    img.onerror = () => reject(new Error('Could not decode selected image.'));
    img.src = rawUrl;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
