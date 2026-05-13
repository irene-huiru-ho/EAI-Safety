import { useState, useEffect } from 'react';
import CameraCapture from '../components/CameraCapture';
import Questionnaire from '../components/Questionnaire';
import SubmissionConfirm from '../components/SubmissionConfirm';
import ReviewImages from '../components/ReviewImages';

const STEP = { RESUME: 'resume', CAMERA: 'camera', QUESTIONS: 'questions', CONFIRM: 'confirm', REVIEW: 'review', DONE: 'done' };
const MIN_IMAGES = 10;

export default function ParticipantFlow({ participantId, onExit }) {
  const [step, setStep] = useState(STEP.CAMERA);
  const [capturedFile, setCapturedFile] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [existingSubmissions, setExistingSubmissions] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resumeSeen, setResumeSeen] = useState(false);

  // Function to load existing submissions
  const loadExistingSubmissions = async () => {
    try {
      const res = await fetch(`/api/submissions/${participantId}`);
      if (!res.ok) throw new Error('Failed to load previous submissions');
      const data = await res.json();
      setExistingSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Error loading submissions:', err);
      // Continue anyway - they can still take new photos
    } finally {
      setIsLoadingExisting(false);
    }
  };

  // Load existing submissions when component mounts
  useEffect(() => {
    loadExistingSubmissions();
  }, [participantId]);

  useEffect(() => {
    if (!isLoadingExisting && existingSubmissions.length > 0 && newImages.length === 0 && step === STEP.CAMERA && !resumeSeen) {
      setStep(STEP.RESUME);
    }
  }, [isLoadingExisting, existingSubmissions.length, newImages.length, step, resumeSeen]);

  function handleCapture(file, preview) {
    const tempId = window.crypto?.randomUUID?.() || `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setCapturedFile(file);
    setCapturedPreview(preview);
    // Preserve oldImageFileId so a retake during edit still replaces the original draft
    setCurrentDraft(prev => ({
      id: tempId, file, preview, status: 'draft',
      oldImageFileId: prev?.oldImageFileId
    }));
    setStep(STEP.QUESTIONS);
  }

  async function handleSubmit({ answers, severity, significance, notes }) {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await uploadAsDraft(capturedFile, { answers, severity, significance, notes });
      setStep(STEP.CONFIRM);
      setCapturedFile(null);
      setCapturedPreview(null);
      setCurrentDraft(null);
    } catch (err) {
      console.error('Upload failed:', err);
      // Keep user on the questionnaire so they can retry
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadAsDraft(file, data) {
    if (!file) {
      const error = new Error('No photo selected. Please take a photo first.');
      setSubmitError(error.message);
      throw error;
    }

    const formData = new FormData();
    formData.append('participantId', participantId);
    formData.append('severity', data.severity);
    formData.append('significance', data.significance);
    formData.append('notes', data.notes);
    formData.append('answers', JSON.stringify(data.answers));
    formData.append('image', file, 'image.jpg');
    formData.append('status', 'draft');
    if (currentDraft?.oldImageFileId) {
      formData.append('oldImageFileId', currentDraft.oldImageFileId);
    }

    try {
      const res = await fetch('/api/submissions', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Upload failed');

      const newImage = {
        id: result.submissionId,
        folderId: result.folderId,        imageFileId: result.imageFileId,        file: file,
        preview: URL.createObjectURL(file),
        answers: data.answers,
        severity: data.severity,
        significance: data.significance,
        notes: data.notes,
        status: 'draft',
        timestamp: new Date().toISOString(),
        imageFilename: result.imageFilename || `${result.submissionId}.jpg`
      };

      if (currentDraft?.id) {
        setNewImages(prev => {
          const updated = prev.map(img => img.id === currentDraft.id ? newImage : img);
          return updated.some(img => img.id === currentDraft.id) ? updated : [...updated, newImage];
        });
      } else {
        setNewImages(prev => [...prev, newImage]);
      }
    } catch (err) {
      setSubmitError(err.message);
      throw err;
    }
  }

  function handleTakeAnother() {
    setCapturedFile(null);
    setCapturedPreview(null);
    setCurrentDraft(null);
    setSubmitError('');
    setStep(STEP.CAMERA);
  }

  function handleReviewImages() {
    setResumeSeen(true);
    setStep(STEP.REVIEW);
  }

  function handleStartFresh() {
    setResumeSeen(true);
    setStep(STEP.CAMERA);
  }

  async function handleFinalSubmit() {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`/api/submissions/${participantId}/submit`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');

      setNewImages([]);
      await loadExistingSubmissions();
      setStep(STEP.DONE);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveImage(imageFileId) {
    if (!imageFileId) {
      setNewImages(prev => prev.filter(img => img.id !== imageFileId));
      return;
    }

    try {
      const res = await fetch(`/api/submissions/${participantId}/${imageFileId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to delete photo');

      setNewImages(prev => prev.filter(img => img.imageFileId !== imageFileId));
      setExistingSubmissions(prev => prev.filter(img => img.imageFileId !== imageFileId));
    } catch (err) {
      console.error('Delete failed:', err);
      setSubmitError(err.message);
    }
  }

  function handleEditImage(imageFileId) {
    const imageToEdit = newImages.find(img => img.imageFileId === imageFileId);
    if (!imageToEdit) return;

    setCapturedFile(imageToEdit.file);
    setCapturedPreview(imageToEdit.preview);
    setCurrentDraft({
      ...imageToEdit,
      id: imageToEdit.id,
      oldImageFileId: imageToEdit.imageFileId  // server will rename old files to edited_*
    });

    // Remove from newImages while editing; restored with new entry on re-submit
    setNewImages(prev => prev.filter(img => img.imageFileId !== imageToEdit.imageFileId));
    setStep(STEP.QUESTIONS);
  }

  if (isLoadingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-gray-600">Loading your previous photos…</div>
      </div>
    );
  }

  if (step === STEP.DONE) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">Thank You!</h2>
        <p className="mt-2 text-gray-500">
          You submitted {newImages.length} photo{newImages.length !== 1 ? 's' : ''}.
          Your contributions help improve home safety research.
        </p>
        <button className="btn-primary mt-8" onClick={onExit}>
          Start a New Session
        </button>
      </div>
    );
  }

  if (step === STEP.RESUME) {
    const totalPhotos = existingSubmissions.length;
    const photosNeeded = Math.max(0, MIN_IMAGES - totalPhotos);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 max-w-md mx-auto text-center">
        <div className="text-6xl mb-4">👋</div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome Back!</h2>
        <p className="mt-4 text-gray-600">
          You have {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} saved from your previous session.
        </p>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 w-full">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            ✓ Previous progress is still available
          </p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {existingSubmissions.slice(0, 4).map((submission, index) => (
              <img
                key={submission.id || `${submission.timestamp}-${index}`}
                src={submission.imageUrl}
                alt={`Previous photo ${index + 1}`}
                className="w-full h-20 object-cover rounded-lg"
              />
            ))}
          </div>
          <button
            onClick={() => setStep(STEP.REVIEW)}
            className="text-sm text-blue-600 underline font-medium"
          >
            View all saved photos
          </button>
        </div>

        {photosNeeded > 0 ? (
          <p className="mt-8 text-gray-600">
            You need {photosNeeded} more photo{photosNeeded !== 1 ? 's' : ''} to complete the required set.
          </p>
        ) : (
          <p className="mt-8 text-green-600">
            You already have the required {MIN_IMAGES} photos.
          </p>
        )}

        <button
          onClick={handleReviewImages}
          className="btn-secondary mt-6 w-full"
        >
          Resume and review progress
        </button>

        <button
          onClick={handleStartFresh}
          className="btn-primary mt-4 w-full"
        >
          Start a new photo session
        </button>
      </div>
    );
  }

  if (step === STEP.REVIEW) {
    return (
      <ReviewImages
        existingSubmissions={existingSubmissions}
        newImages={newImages}
        onRemove={handleRemoveImage}
        onEdit={handleEditImage}
        onConfirmSubmit={handleFinalSubmit}
        onBack={() => setStep(STEP.CAMERA)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    );
  }

  if (step === STEP.CAMERA) {
    const collectedCount = existingSubmissions.length + newImages.length;
    const photosNeeded = Math.max(0, MIN_IMAGES - collectedCount);

    return (
      <CameraCapture
        submissionCount={newImages.length}
        existingCount={existingSubmissions.length}
        photoNumber={collectedCount + 1}
        photosNeeded={photosNeeded}
        requiredPhotos={MIN_IMAGES}
        onCapture={handleCapture}
        onCancel={onExit}
        onReview={() => setStep(STEP.REVIEW)}
      />
    );
  }

  if (step === STEP.QUESTIONS) {
    return (
      <div>
        {submitError && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm text-center py-2 px-4">
            Upload failed: {submitError} — <button className="underline" onClick={() => setSubmitError('')}>dismiss</button>
          </div>
        )}
        <Questionnaire
          imagePreview={capturedPreview}
          onSubmit={handleSubmit}
          onBack={() => {
            setStep(STEP.CAMERA);
          }}
          isSubmitting={isSubmitting}
          initialAnswers={currentDraft?.answers}
          initialSeverity={currentDraft?.severity}
          initialSignificance={currentDraft?.significance}
          initialNotes={currentDraft?.notes || ''}
        />
      </div>
    );
  }

  if (step === STEP.CONFIRM) {
    return (
      <SubmissionConfirm
        count={existingSubmissions.length + newImages.length}
        minRequired={MIN_IMAGES}
        onTakeAnother={handleTakeAnother}
        onReview={handleReviewImages}
      />
    );
  }

  return null;
}
