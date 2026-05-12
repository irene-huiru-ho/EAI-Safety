import { useRef, useState } from 'react';

export default function CameraCapture({ onCapture, onCancel, submissionCount, existingCount, photoNumber, photosNeeded, requiredPhotos, onReview }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleRetake() {
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleUse() {
    if (file) onCapture(file, preview);
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onCancel} className="text-sm text-gray-300 active:text-white">
          ← Back
        </button>
        <div className="text-center">
          <span className="text-sm font-medium">Photo {photoNumber}</span>
          {(existingCount > 0 || submissionCount > 0) && (
            <p className="text-xs text-gray-400 mt-1">
              ({existingCount} previous photo{existingCount !== 1 ? 's' : ''}{submissionCount > 0 ? ` + ${submissionCount} new` : ''})
            </p>
          )}
        </div>
        <div className="text-right">
          {existingCount + submissionCount > 0 ? (
            <button onClick={onReview} className="text-sm text-blue-300 active:text-blue-400 font-medium">
              Review Photos
            </button>
          ) : (
            <div className="w-12" />
          )}
        </div>
      </div>

      {preview ? (
        <>
          <div className="flex-1 relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="p-4 space-y-3 bg-gray-900">
            <button
              onClick={handleUse}
              className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl text-lg active:bg-blue-700"
            >
              Use This Photo
            </button>
            <button
              onClick={handleRetake}
              className="w-full py-4 bg-gray-700 text-white font-semibold rounded-xl text-lg active:bg-gray-600"
            >
              Retake
            </button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="text-6xl mb-6">📷</div>
          <p className="text-white text-lg font-medium mb-2">
            Take a photo of a potential safety concern
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Point your camera at anything that might be a physical interaction risk or hazard in your home.
          </p>

          {photosNeeded > 0 ? (
            <p className="text-sm text-yellow-200 mb-4">
              You have collected {existingCount + submissionCount} of {requiredPhotos} photos. Keep going to finish the set.
            </p>
          ) : (
            <p className="text-sm text-green-200 mb-4">
              Great work — you've reached the required {requiredPhotos} photos. Feel free to add more if you'd like.
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => inputRef.current?.click()}
            className="w-full max-w-xs py-4 bg-blue-600 text-white font-semibold rounded-xl text-lg active:bg-blue-700"
          >
            Open Camera
          </button>

          <p className="mt-4 text-xs text-gray-500">
            Tap "Open Camera" to use your phone's camera.
          </p>
        </div>
      )}
    </div>
  );
}
