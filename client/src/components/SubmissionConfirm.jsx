export default function SubmissionConfirm({ count, minRequired, onTakeAnother, onReview }) {
  const canReview = count >= minRequired;
  const photosNeeded = Math.max(0, minRequired - count);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-gray-900">Photo Saved!</h2>
      <p className="mt-2 text-gray-500">
        {count} of {minRequired} photos collected
      </p>

      {/* Progress Bar */}
      <div className="mt-6 w-full">
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
          <div
            className={`h-full transition-all duration-300 ${
              canReview ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min((count / minRequired) * 100, 100)}%` }}
          />
        </div>
        <p className="text-sm font-medium text-gray-700">
          {canReview
            ? `✓ You have enough! Feel free to add more photos or review.`
            : `${photosNeeded} more ${photosNeeded === 1 ? 'photo' : 'photos'} needed`}
        </p>
      </div>

      <div className="mt-8 w-full space-y-3">
        <button className="btn-primary" onClick={onTakeAnother}>
          Take Another Photo
        </button>
        <button
          className={`btn-primary ${!canReview ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={onReview}
          disabled={!canReview}
        >
          {canReview ? 'Review & Submit' : 'Keep Taking Photos'}
        </button>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        All data is securely uploaded to the research team.
        You can close this app at any time.
      </p>
    </div>
  );
}
