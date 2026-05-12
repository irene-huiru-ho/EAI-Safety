import { useState } from 'react';

const MIN_IMAGES = 10;

export default function ReviewImages({ existingSubmissions, newImages, onRemove, onEdit, onConfirmSubmit, onBack, isSubmitting, submitError }) {
  const [expandedId, setExpandedId] = useState(null);
  const allImages = [...existingSubmissions, ...newImages];
  const canSubmit = allImages.length >= MIN_IMAGES;

  return (
    <div className="min-h-screen bg-gray-50 pt-4 pb-8 px-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <button
          onClick={onBack}
          className="text-sm text-blue-600 font-medium mb-4 active:text-blue-700"
        >
          ← Back to Camera
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Review Your Photos</h1>
        <p className="text-sm text-gray-600 mt-1">
          {allImages.length} of {MIN_IMAGES} photos collected
        </p>
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="max-w-2xl mx-auto mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
          Upload failed: {submitError}
        </div>
      )}

      {/* Progress Bar */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              canSubmit ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min((allImages.length / MIN_IMAGES) * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {canSubmit
            ? `✓ You have ${allImages.length - MIN_IMAGES} extra photo${allImages.length - MIN_IMAGES !== 1 ? 's' : ''}! Feel free to submit or add more.`
            : `You need ${MIN_IMAGES - allImages.length} more photo${MIN_IMAGES - allImages.length !== 1 ? 's' : ''} to submit.`}
        </p>
      </div>

      {/* Images Grid */}
      <div className="max-w-2xl mx-auto grid grid-cols-2 gap-4 mb-8">
        {allImages.map((image, index) => {
          const isExisting = existingSubmissions.includes(image);
          const isEditable = !isExisting || image.status === 'draft';

          return (
            <div key={image.id || image.submissionId} className="relative">
              <button
                onClick={() => setExpandedId(expandedId === (image.id || image.submissionId) ? null : (image.id || image.submissionId))}
                className="w-full aspect-square bg-gray-200 rounded-lg overflow-hidden relative group hover:opacity-75 transition"
              >
                <img
                  src={image.preview || image.imageUrl}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                  <div className="absolute top-2 right-2 bg-gray-900 bg-opacity-70 text-white px-2 py-1 rounded text-xs font-semibold">
                    {index + 1}
                  </div>
                  {isExisting && (
                    <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                      {image.status === 'submitted' ? 'Submitted' : 'Draft'}
                    </div>
                  )}
                </div>
              </button>

              {/* Action buttons */}
              {isEditable && (
                <div className="absolute bottom-2 left-2 right-2 flex gap-1">
                  {!isExisting && (
                    <button
                      onClick={() => onEdit(image.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 text-xs font-semibold"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => onRemove(image.id || image.submissionId)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                      isExisting && image.status === 'submitted'
                        ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                    disabled={isExisting && image.status === 'submitted'}
                    title={isExisting && image.status === 'submitted' ? 'Cannot remove submitted photos' : 'Remove this photo'}
                  >
                    {isExisting && image.status === 'submitted' ? 'Locked' : 'Remove'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded Details Modal */}
      {expandedId && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setExpandedId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full max-h-96 overflow-y-auto relative"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const image = allImages.find(img => (img.id || img.submissionId) === expandedId);
              const index = allImages.findIndex(img => (img.id || img.submissionId) === expandedId);
              const isExisting = existingSubmissions.includes(image);

              if (!image) {
                return (
                  <div className="text-center text-gray-600 py-8">
                    <p>Photo details are unavailable.</p>
                    <button
                      onClick={() => setExpandedId(null)}
                      className="mt-4 py-2 px-4 bg-blue-600 text-white rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                );
              }

              return (
                <>
                  <button
                    onClick={() => setExpandedId(null)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg font-bold"
                  >
                    ×
                  </button>
                  <h3 className="font-semibold text-gray-900 mb-3 pr-6">
                    Photo {index + 1} Details
                    {isExisting && (
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${
                        image.status === 'submitted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {image.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </span>
                    )}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <p className="font-semibold text-gray-900">Severity:</p>
                      <p>{image.severity}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Significance:</p>
                      <p>{image.significance}</p>
                    </div>
                    {image.notes && (
                      <div>
                        <p className="font-semibold text-gray-900">Additional Notes:</p>
                        <p>{image.notes}</p>
                      </div>
                    )}
                    {image.answers && Object.keys(image.answers).length > 0 && (
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Survey Responses:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {Object.entries(image.answers).map(([key, value]) => (
                            <li key={key} className="text-xs">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="max-w-2xl mx-auto fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          <button
            onClick={onConfirmSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`w-full py-4 font-semibold rounded-xl text-lg transition ${
              canSubmit
                ? 'bg-green-600 text-white active:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Uploading...' : `Submit ${allImages.length} Photo${allImages.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={onBack}
            disabled={isSubmitting}
            className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl active:bg-gray-200"
          >
            Take More Photos
          </button>
        </div>
      </div>

      {/* Spacer for fixed bottom */}
      <div className="h-32" />
    </div>
  );
}
