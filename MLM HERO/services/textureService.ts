
export interface PBRMaps {
  normal: string;
  roughness: string;
  orm: string; // Unreal Engine Packed (Occlusion, Roughness, Metallic)
  height: string;
}

export const generateMaps = async (imageUrl: string): Promise<PBRMaps> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject("Could not get canvas context");
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Buffers
      const normalData = new Uint8ClampedArray(data.length);
      const roughnessData = new Uint8ClampedArray(data.length);
      const ormData = new Uint8ClampedArray(data.length);
      const heightData = new Uint8ClampedArray(data.length);

      const getLuminance = (r: number, g: number, b: number) => {
        return 0.299 * r + 0.587 * g + 0.114 * b;
      };

      const getGray = (x: number, y: number) => {
        if (x < 0) x = 0;
        if (x >= width) x = width - 1;
        if (y < 0) y = 0;
        if (y >= height) y = height - 1;
        const idx = (y * width + x) * 4;
        return getLuminance(data[idx], data[idx + 1], data[idx + 2]) / 255;
      };

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        const luminance = getLuminance(r, g, b);
        
        // --- Height Map (Simple Grayscale) ---
        // Lighter = Higher
        heightData[i] = luminance;
        heightData[i + 1] = luminance;
        heightData[i + 2] = luminance;
        heightData[i + 3] = a;

        // --- Roughness Map (Standard) ---
        // Darker = Smoother/Shinier. Lighter = Rougher.
        const roughVal = 255 - luminance;
        roughnessData[i] = roughVal;
        roughnessData[i + 1] = roughVal;
        roughnessData[i + 2] = roughVal;
        roughnessData[i + 3] = a;

        // --- ORM Map (Unreal Engine: Occlusion (R), Roughness (G), Metallic (B)) ---
        const occlusion = Math.max(0, luminance - 50); // Simple approx
        const metallic = 0; 

        ormData[i] = occlusion;      // R: Occlusion
        ormData[i + 1] = roughVal;   // G: Roughness
        ormData[i + 2] = metallic;   // B: Metallic
        ormData[i + 3] = a;
      }

      // --- Normal Map (Sobel Operator) ---
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];

          if (alpha < 10) {
              normalData[idx] = 128;
              normalData[idx+1] = 128;
              normalData[idx+2] = 255;
              normalData[idx+3] = 0;
              continue;
          }

          // Sobel kernels
          const tl = getGray(x-1, y-1);
          const t  = getGray(x,   y-1);
          const tr = getGray(x+1, y-1);
          const l  = getGray(x-1, y);
          const r  = getGray(x+1, y);
          const bl = getGray(x-1, y+1);
          const b  = getGray(x,   y+1);
          const br = getGray(x+1, y+1);

          const dX = (tr + 2*r + br) - (tl + 2*l + bl);
          const dY = (bl + 2*b + br) - (tl + 2*t + tr);
          const dZ = 1.0 / 3.0; // Strength adjuster

          const len = Math.sqrt(dX*dX + dY*dY + dZ*dZ);
          
          // Map -1..1 to 0..255
          const nx = ((dX / len) * 0.5 + 0.5) * 255;
          const ny = ((dY / len) * 0.5 + 0.5) * 255;
          const nz = ((dZ / len) * 0.5 + 0.5) * 255;

          normalData[idx] = nx;
          normalData[idx + 1] = ny;
          normalData[idx + 2] = nz;
          normalData[idx + 3] = alpha;
        }
      }

      const bufferToUrl = (buf: Uint8ClampedArray) => {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const cx = c.getContext('2d');
        if (!cx) return '';
        const id = new ImageData(buf, width, height);
        cx.putImageData(id, 0, 0);
        return c.toDataURL('image/png');
      };

      resolve({
          roughness: bufferToUrl(roughnessData),
          normal: bufferToUrl(normalData),
          orm: bufferToUrl(ormData),
          height: bufferToUrl(heightData)
      });
    };
    
    img.onerror = (e) => reject(e);
  });
};
